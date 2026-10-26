import type { ScryfallCard, ScryfallSet } from './types';

export interface BulkSetSummary {
  code: string;
  name: string;
  setType: string;
  count: number;
}

/** Strip legacy-array decoration from one line; returns '' for lines with no payload. */
function cleanLine(raw: string): string {
  let line = raw.trim();
  if (line.startsWith('[')) line = line.slice(1).trimStart();
  if (line.endsWith(']')) line = line.slice(0, -1).trimEnd();
  if (line.endsWith(',')) line = line.slice(0, -1).trimEnd();
  return line;
}

/**
 * Stream a Scryfall bulk file (JSONL or legacy one-card-per-line JSON array) card by card.
 * `onBytes` receives the cumulative number of source (compressed, if gzip) bytes read.
 * Never buffers more than one chunk plus one partial line.
 */
export async function readBulkStream(
  stream: ReadableStream<Uint8Array>,
  gzip: boolean,
  onCard: (card: unknown) => void,
  onBytes?: (bytes: number) => void,
): Promise<{ malformed: number }> {
  let total = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      onBytes?.(total);
      controller.enqueue(chunk);
    },
  });

  let piped: ReadableStream<Uint8Array> = stream.pipeThrough(counter);
  if (gzip) {
    piped = piped.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
  }
  const reader = piped.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();

  let malformed = 0;
  const handle = (raw: string) => {
    const line = cleanLine(raw);
    if (!line) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformed++;
      return;
    }
    onCard(parsed);
  };

  let carry = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const parts = (carry + value).split('\n');
    carry = parts.pop() ?? '';
    for (const part of parts) handle(part);
  }
  handle(carry);
  return { malformed };
}

export async function isGzip(blob: Blob): Promise<boolean> {
  const b = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return b.length === 2 && b[0] === 0x1f && b[1] === 0x8b;
}

async function readBlob(
  file: Blob,
  onCard: (card: unknown) => void,
  onProgress?: (read: number, total: number) => void,
): Promise<{ malformed: number }> {
  const gzip = await isGzip(file);
  return readBulkStream(
    file.stream() as ReadableStream<Uint8Array>,
    gzip,
    onCard,
    onProgress && (read => onProgress(read, file.size)),
  );
}

export async function scanBulk(
  file: Blob,
  onProgress?: (read: number, total: number) => void,
): Promise<{ sets: BulkSetSummary[]; malformed: number }> {
  const sets = new Map<string, BulkSetSummary>();
  const { malformed } = await readBlob(
    file,
    raw => {
      const c = raw as Partial<ScryfallCard> | null;
      if (!c || typeof c.set !== 'string') return;
      const existing = sets.get(c.set);
      if (existing) existing.count++;
      else sets.set(c.set, { code: c.set, name: c.set_name ?? c.set, setType: c.set_type ?? '', count: 1 });
    },
    onProgress,
  );
  return { sets: [...sets.values()], malformed };
}

export async function collectBulk(
  file: Blob,
  codes: string[],
  onProgress?: (read: number, total: number) => void,
): Promise<{ cards: ScryfallCard[]; malformed: number }> {
  const wanted = new Set(codes);
  const cards: ScryfallCard[] = [];
  const { malformed } = await readBlob(
    file,
    raw => {
      const c = raw as ScryfallCard | null;
      if (c && wanted.has(c.set)) cards.push(c);
    },
    onProgress,
  );
  return { cards, malformed };
}

/** Token-set code -> parent set code. Known `/sets` data wins; otherwise the `t<code>` convention. */
export function resolveTokenParents(summaries: BulkSetSummary[], known: ScryfallSet[] = []): Map<string, string> {
  const knownByCode = new Map(known.map(s => [s.code, s]));
  const present = new Set(summaries.map(s => s.code));
  const result = new Map<string, string>();
  for (const s of summaries) {
    const k = knownByCode.get(s.code);
    if (s.setType !== 'token' && k?.set_type !== 'token') continue;
    if (k?.parent_set_code) {
      result.set(s.code, k.parent_set_code);
    } else if (s.code.length > 1 && s.code.startsWith('t') && present.has(s.code.slice(1))) {
      result.set(s.code, s.code.slice(1));
    }
  }
  return result;
}
