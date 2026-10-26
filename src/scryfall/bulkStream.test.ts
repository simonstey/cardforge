import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  collectBulk,
  isGzip,
  readBulkStream,
  resolveTokenParents,
  scanBulk,
  type BulkSetSummary,
} from './bulkStream';
import type { ScryfallSet } from './types';

const card = (id: string, set: string, set_name = set.toUpperCase(), set_type = 'expansion') => ({
  id,
  name: `Card ${id}`,
  set,
  set_name,
  set_type,
});

const enc = (s: string) => new TextEncoder().encode(s);

const jsonl = (cards: object[]) => cards.map(c => JSON.stringify(c)).join('\n') + '\n';

async function read(blob: Blob, gzip: boolean) {
  const cards: unknown[] = [];
  const res = await readBulkStream(blob.stream(), gzip, c => cards.push(c));
  return { cards, ...res };
}

describe('readBulkStream', () => {
  const cards = [card('1', 'neo'), card('2', 'neo'), card('3', 'mh3')];

  it('reads a gzipped JSONL file', async () => {
    const blob = new Blob([gzipSync(enc(jsonl(cards)))]);
    expect(await isGzip(blob)).toBe(true);
    const r = await read(blob, true);
    expect(r.cards).toEqual(cards);
    expect(r.malformed).toBe(0);
  });

  it('reads plain JSONL', async () => {
    const blob = new Blob([jsonl(cards)]);
    expect(await isGzip(blob)).toBe(false);
    const r = await read(blob, false);
    expect(r.cards).toEqual(cards);
  });

  it('reads the legacy JSON array format', async () => {
    const text = '[\n' + cards.map(c => JSON.stringify(c)).join(',\n') + '\n]\n';
    const r = await read(new Blob([text]), false);
    expect(r.cards).toEqual(cards);
    expect(r.malformed).toBe(0);
  });

  it('skips and counts malformed lines', async () => {
    const text = `${JSON.stringify(cards[0])}\n{not json\n\n   \n${JSON.stringify(cards[1])}\n]]]\n`;
    const r = await read(new Blob([text]), false);
    expect(r.cards).toEqual([cards[0], cards[1]]);
    expect(r.malformed).toBe(2);
  });

  it('handles a card split across chunk boundaries', async () => {
    const bytes = enc(jsonl([...cards, card('4', 'é-set', 'Ünïcode ☃')]));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    });
    const got: unknown[] = [];
    const seen: number[] = [];
    const r = await readBulkStream(stream, false, c => got.push(c), b => seen.push(b));
    expect(got).toHaveLength(4);
    expect(got[3]).toMatchObject({ set_name: 'Ünïcode ☃' });
    expect(r.malformed).toBe(0);
    expect(seen[seen.length - 1]).toBe(bytes.length);
  });

  it('stops reading and cancels the source when the signal aborts', async () => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Finite, so a reader that ignores the signal fails the test instead of hanging it.
        if (++pulls > 1000) controller.close();
        else controller.enqueue(enc(jsonl([card(String(pulls), 'neo')])));
      },
      cancel() {
        cancelled = true;
      },
    });
    const controller = new AbortController();
    const got: unknown[] = [];
    const read = readBulkStream(stream, false, c => {
      got.push(c);
      if (got.length === 2) controller.abort();
    }, undefined, controller.signal);
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(cancelled).toBe(true));
    expect(got).toHaveLength(2);
  });

  it('lets timers run during a long cancellable read, so a cancel message can arrive', async () => {
    const lines = enc(jsonl(Array.from({ length: 50 }, (_, i) => card(String(i), 'neo'))));
    let pulls = 0;
    // Synchronous pulls: without a yield, the whole read runs on microtasks.
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (++pulls > 4000) controller.close();
        else controller.enqueue(lines);
      },
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    let cards = 0;
    await expect(readBulkStream(stream, false, () => cards++, undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(cards).toBeLessThan(4000 * 50);
  });

  it('flushes a final line without trailing newline', async () => {
    const r = await read(new Blob([JSON.stringify(cards[0])]), false);
    expect(r.cards).toEqual([cards[0]]);
  });
});

describe('scanBulk / collectBulk', () => {
  const cards = [
    card('1', 'neo', 'Kamigawa: Neon Dynasty'),
    card('2', 'neo', 'Kamigawa: Neon Dynasty'),
    card('3', 'mh3', 'Modern Horizons 3'),
    card('4', 'tneo', 'Kamigawa: Neon Dynasty Tokens', 'token'),
  ];
  const gz = () => new Blob([gzipSync(enc(jsonl(cards)))]);

  it('scanBulk summarises sets with counts', async () => {
    const calls: Array<[number, number]> = [];
    const blob = gz();
    const r = await scanBulk(blob, (read, total) => calls.push([read, total]));
    expect(r.malformed).toBe(0);
    expect(r.sets).toHaveLength(3);
    expect(r.sets.find(s => s.code === 'neo')).toEqual({
      code: 'neo',
      name: 'Kamigawa: Neon Dynasty',
      setType: 'expansion',
      count: 2,
    });
    expect(r.sets.find(s => s.code === 'tneo')?.setType).toBe('token');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toEqual([blob.size, blob.size]);
  });

  it('collectBulk keeps only chosen sets', async () => {
    const r = await collectBulk(gz(), ['mh3', 'tneo']);
    expect(r.cards.map(c => c.id)).toEqual(['3', '4']);
    expect(r.malformed).toBe(0);
  });
});

describe('resolveTokenParents', () => {
  const sum = (code: string, setType = 'expansion', name = code): BulkSetSummary => ({ code, name, setType, count: 1 });

  it('maps each set to the one token set the shared rule picks', () => {
    const summaries = [
      sum('neo'),
      sum('sneo', 'token', 'Kamigawa: Neon Dynasty Substitute Cards'),
      sum('tneo', 'token'),
      sum('mh3'),
      sum('wmh3', 'token'),
      sum('tzzz', 'token'),
    ];
    const known = [
      { code: 'sneo', name: 'Kamigawa: Neon Dynasty Substitute Cards', set_type: 'token', parent_set_code: 'neo' },
      { code: 'wmh3', name: 'Modern Horizons 3 Tokens', set_type: 'token', parent_set_code: 'mh3' },
    ] as ScryfallSet[];
    const online = resolveTokenParents(summaries, known);
    expect([...online]).toEqual([
      ['tneo', 'neo'],
      ['wmh3', 'mh3'],
    ]);
    // Offline only the `t<code>` convention applies.
    expect([...resolveTokenParents(summaries)]).toEqual([['tneo', 'neo']]);
  });

  it('reads a token set from the set list even when its cards say otherwise', () => {
    const summaries = [sum('neo'), sum('tneo')];
    const known = [{ code: 'tneo', name: 'Kamigawa: Neon Dynasty Tokens', set_type: 'token', parent_set_code: 'neo' }] as ScryfallSet[];
    expect(resolveTokenParents(summaries, known).get('tneo')).toBe('neo');
    expect(resolveTokenParents(summaries).size).toBe(0);
  });
});
