import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createBulkHandler, PROGRESS_STEP, runBulkJob, type BulkResponse } from './bulkJob';

const line = (i: number, set: string) =>
  JSON.stringify({ id: String(i), name: `Card ${i}`, set, set_name: set.toUpperCase(), set_type: 'expansion', pad: 'x'.repeat(200) });

/**
 * A plain JSONL file of `n` cards (≈ 290 bytes each) alternating between two sets. One blob part
 * per line, because Node streams a blob one part per chunk.
 */
const jsonlFile = (n: number) =>
  new File(Array.from({ length: n }, (_, i) => `${line(i, i % 2 ? 'neo' : 'dmu')}\n`), 'cards.jsonl');

async function run(req: Parameters<typeof runBulkJob>[0], signal?: AbortSignal) {
  const messages: BulkResponse[] = [];
  await runBulkJob(req, m => messages.push(m), signal);
  return messages;
}

describe('runBulkJob', () => {
  it('scans a file, posting progress at most once per step plus a final one', async () => {
    const file = jsonlFile(15_000);
    expect(file.size).toBeGreaterThan(3 * PROGRESS_STEP);
    const messages = await run({ type: 'scan', file });

    const progress = messages.flatMap(m => (m.type === 'progress' ? [m] : []));
    expect(progress.length).toBeGreaterThanOrEqual(3);
    expect(progress.length).toBeLessThanOrEqual(Math.ceil(file.size / PROGRESS_STEP) + 1);
    for (const m of progress) expect(m.total).toBe(file.size);
    for (let i = 1; i < progress.length - 1; i++) {
      expect(progress[i].read - progress[i - 1].read).toBeGreaterThanOrEqual(PROGRESS_STEP);
    }
    expect(progress[progress.length - 1].read).toBe(file.size);

    const last = messages[messages.length - 1];
    expect(last.type).toBe('scanned');
    if (last.type !== 'scanned') return;
    expect(last.malformed).toBe(0);
    expect(last.sets.map(s => [s.code, s.count])).toEqual([
      ['dmu', 7_500],
      ['neo', 7_500],
    ]);
  });

  it('collects the chosen sets from a gzipped file', async () => {
    const text = [line(1, 'neo'), line(2, 'dmu'), '{oops', line(3, 'tneo')].join('\n');
    const file = new File([gzipSync(new TextEncoder().encode(text))], 'cards.jsonl.gz');
    const messages = await run({ type: 'collect', file, codes: ['neo', 'tneo'] });
    expect(messages[0]).toEqual({ type: 'progress', read: file.size, total: file.size });
    const last = messages[messages.length - 1];
    expect(last.type).toBe('collected');
    if (last.type !== 'collected') return;
    expect(last.cards.map(c => c.id)).toEqual(['1', '3']);
    expect(last.malformed).toBe(1);
  });

  it('posts cancelled, not an error, when its signal aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await run({ type: 'scan', file: jsonlFile(10) }, controller.signal)).toEqual([{ type: 'cancelled' }]);
  });

  it('posts an error for a broken gzip file instead of throwing', async () => {
    const gz = gzipSync(new TextEncoder().encode(line(1, 'neo').repeat(50)));
    const file = new File([gz.subarray(0, gz.length >> 1)], 'cut.jsonl.gz');
    const messages = await run({ type: 'scan', file });
    const last = messages[messages.length - 1];
    expect(last.type).toBe('error');
    if (last.type === 'error') expect(last.message).not.toBe('');
  });
});

describe('createBulkHandler', () => {
  const settle = (messages: BulkResponse[], type: BulkResponse['type']) =>
    vi.waitFor(() => expect(messages.map(m => m.type)).toContain(type), { timeout: 5000 });

  it('runs a job and posts its result', async () => {
    const messages: BulkResponse[] = [];
    createBulkHandler(m => messages.push(m))({ type: 'scan', file: jsonlFile(10) });
    await settle(messages, 'scanned');
  });

  it('stops a running job on cancel and acknowledges it', async () => {
    const messages: BulkResponse[] = [];
    const handle = createBulkHandler(m => {
      messages.push(m);
      if (m.type === 'progress' && messages.length === 1) handle({ type: 'cancel' });
    });
    handle({ type: 'scan', file: jsonlFile(15_000) });
    await settle(messages, 'cancelled');
    expect(messages.map(m => m.type)).not.toContain('scanned');
    expect(messages.filter(m => m.type === 'progress').length).toBeLessThanOrEqual(2);
  });

  it('acknowledges a cancel when no job is running', () => {
    const messages: BulkResponse[] = [];
    createBulkHandler(m => messages.push(m))({ type: 'cancel' });
    expect(messages).toEqual([{ type: 'cancelled' }]);
  });
});
