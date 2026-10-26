/**
 * Module Web Worker for the bulk file import (spec 6.12). It reads the file off the main thread;
 * the protocol and the work live in `bulkJob.ts`. Create it with
 * `new Worker(new URL('../scryfall/bulkWorker.ts', import.meta.url), { type: 'module' })`.
 */
import { createBulkHandler, type BulkRequest, type BulkResponse } from './bulkJob';

// tsconfig's `lib` has DOM, not WebWorker, so type just the part of the worker scope used here.
const ctx = self as unknown as {
  postMessage(message: BulkResponse): void;
  onmessage: ((e: MessageEvent<BulkRequest>) => void) | null;
};

const handle = createBulkHandler(message => ctx.postMessage(message));
ctx.onmessage = e => handle(e.data);
