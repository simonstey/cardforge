import type { ScryfallErrorBody, ScryfallList } from './types';

const API_BASE = 'https://api.scryfall.com';
/** Scryfall locks a client out for 30 s after a 429 (docs/scryfall-api.md §2). */
const RATE_LIMIT_PAUSE_MS = 30_000;
const MAX_RETRIES = 2;
/** The endpoints limited to 2 requests per second. */
const SLOW_PATHS = ['/cards/search', '/cards/named', '/cards/random', '/cards/collection'];

export class ScryfallApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ScryfallApiError';
    this.status = status;
    this.code = code;
  }
}

export type ClientStatus = { kind: 'ok' } | { kind: 'rate-limited'; resumeAt: number };

export interface ClientDeps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onStatus?: (s: ClientStatus) => void;
}

export interface ScryfallClient {
  get<T>(pathOrUrl: string, signal?: AbortSignal): Promise<T>;
  getAll<T>(pathOrUrl: string, signal?: AbortSignal, onPage?: (fetched: number, total?: number) => void): Promise<T[]>;
  setStatusListener(fn?: (s: ClientStatus) => void): void;
}

const abortError = () => new DOMException('Aborted', 'AbortError');
const noop = () => undefined;
const toUrl = (pathOrUrl: string) => new URL(pathOrUrl, API_BASE).href;
const isSearch = (url: string) => new URL(url, API_BASE).pathname.startsWith('/cards/search');

/** Minimum gap (ms) between the previous request's start and a request to `url`. */
export function spacingFor(url: string): 500 | 100 {
  const path = new URL(url, API_BASE).pathname;
  return SLOW_PATHS.some((p) => path.startsWith(p)) ? 500 : 100;
}

/** `setTimeout` as a promise that rejects early, and clears the timer, on abort. */
function sleepFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** The Scryfall error object's `details` when the body has one, else a generic message. */
async function toError(res: Response): Promise<ScryfallApiError> {
  const body = (await res.json().catch(noop)) as Partial<ScryfallErrorBody> | null | undefined;
  if (body?.object === 'error' && typeof body.details === 'string') {
    return new ScryfallApiError(body.details, res.status, body.code);
  }
  return new ScryfallApiError(`Scryfall request failed (HTTP ${res.status}).`, res.status);
}

/**
 * A Scryfall API client with one serial request queue (spec 6.5): requests are spaced
 * from the previous request's start, and a 429 pauses the whole queue for 30 s.
 */
export function createClient(deps: ClientDeps = {}): ScryfallClient {
  const fetchFn: typeof fetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? sleepFor;
  let onStatus = deps.onStatus;

  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = -Infinity;
  let pausedUntil = -Infinity;
  let rateLimited = false;

  /**
   * Runs `task` after every earlier one. An abort rejects at once, even while queued;
   * the task itself checks the signal before it sends anything.
   */
  function enqueue<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError());
    const run = queue.then(task);
    queue = run.then(noop, noop);
    if (!signal) return run;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(abortError());
      signal.addEventListener('abort', onAbort, { once: true });
      run.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  /** Sends one request, waiting out spacing and 429 pauses. Returns the last response. */
  async function send(url: string, signal?: AbortSignal): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(lastStart + spacingFor(url), pausedUntil) - now();
      if (wait > 0) await sleep(wait, signal);
      if (signal?.aborted) throw abortError();
      lastStart = now();
      const res = await fetchFn(url, { headers: { Accept: 'application/json' }, signal });
      if (res.status !== 429) {
        if (rateLimited) {
          rateLimited = false;
          onStatus?.({ kind: 'ok' });
        }
        return res;
      }
      // Later requests, including other calls', wait out the lockout too.
      pausedUntil = now() + RATE_LIMIT_PAUSE_MS;
      rateLimited = true;
      onStatus?.({ kind: 'rate-limited', resumeAt: pausedUntil });
      if (attempt === MAX_RETRIES) return res;
    }
  }

  async function get<T>(pathOrUrl: string, signal?: AbortSignal): Promise<T> {
    const url = toUrl(pathOrUrl);
    const res = await enqueue(() => send(url, signal), signal);
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  }

  /** Every item of a List, following `next_page` while `has_more`; one queued request per page. */
  async function getAll<T>(
    pathOrUrl: string,
    signal?: AbortSignal,
    onPage?: (fetched: number, total?: number) => void,
  ): Promise<T[]> {
    const first = toUrl(pathOrUrl);
    const items: T[] = [];
    let total: number | undefined;
    let url: string | null | undefined = first;
    while (url) {
      let page: ScryfallList<T>;
      try {
        page = await get<ScryfallList<T>>(url, signal);
      } catch (err) {
        // A search with no matches is a 404 on its first page, not an empty List.
        const notFound = err instanceof ScryfallApiError && err.status === 404;
        if (notFound && url === first && isSearch(url)) return [];
        throw err;
      }
      total ??= page.total_cards;
      items.push(...page.data);
      onPage?.(items.length, total);
      url = page.has_more ? page.next_page : undefined;
    }
    return items;
  }

  return {
    get,
    getAll,
    setStatusListener(fn) {
      onStatus = fn;
    },
  };
}

/** The app-wide client: every Scryfall request goes through this one queue. */
export const scryfall = createClient();
