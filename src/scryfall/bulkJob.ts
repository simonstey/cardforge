import { collectBulk, scanBulk, type BulkSetSummary } from './bulkStream';
import type { ScryfallCard } from './types';

/**
 * What the dialog asks the bulk worker (spec 6.12): pass 1 scans the sets, pass 2 collects chosen ones.
 * `cancel` stops the running pass; the dialog terminates the worker once it answers `cancelled`.
 */
export type BulkRequest = { type: 'scan'; file: File } | { type: 'collect'; file: File; codes: string[] } | { type: 'cancel' };

export type BulkResponse =
  | { type: 'progress'; read: number; total: number }
  | { type: 'scanned'; sets: BulkSetSummary[]; malformed: number }
  | { type: 'collected'; cards: ScryfallCard[]; malformed: number }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

type BulkJob = Exclude<BulkRequest, { type: 'cancel' }>;

/** Progress goes out at most once per this many source bytes, plus once when the file is read. */
export const PROGRESS_STEP = 1 << 20;

/**
 * Runs one pass, posting its progress and then its result. Never rejects: a failure posts `error`,
 * and an aborted `signal` posts `cancelled`.
 */
export async function runBulkJob(request: BulkJob, post: (message: BulkResponse) => void, signal?: AbortSignal): Promise<void> {
  let posted = 0;
  const onProgress = (read: number, total: number) => {
    if (read - posted < PROGRESS_STEP && read < total) return;
    posted = read;
    post({ type: 'progress', read, total });
  };
  try {
    if (request.type === 'scan') {
      const { sets, malformed } = await scanBulk(request.file, onProgress, signal);
      post({ type: 'scanned', sets, malformed });
    } else {
      const { cards, malformed } = await collectBulk(request.file, request.codes, onProgress, signal);
      post({ type: 'collected', cards, malformed });
    }
  } catch (err) {
    if (signal?.aborted) post({ type: 'cancelled' });
    // Node's zlib errors can have an empty message, so fall back to the name.
    else post({ type: 'error', message: err instanceof Error ? err.message || err.name : String(err) });
  }
}

/**
 * The worker's message handler. The dialog sends one pass per worker; `cancel` aborts it, which
 * cancels the file read before the pass answers `cancelled` (straight away when nothing runs).
 */
export function createBulkHandler(post: (message: BulkResponse) => void): (request: BulkRequest) => void {
  let running: AbortController | null = null;
  return request => {
    if (request.type === 'cancel') {
      if (running) running.abort();
      else post({ type: 'cancelled' });
      return;
    }
    const controller = new AbortController();
    running = controller;
    void runBulkJob(request, post, controller.signal).finally(() => {
      if (running === controller) running = null;
    });
  };
}
