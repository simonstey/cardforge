import { afterEach, expect, test, vi } from 'vitest';
import { createClient, ScryfallApiError, spacingFor, type ClientStatus } from './client';

const API = 'https://api.scryfall.com';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tooMany = () => json({ object: 'error', code: 'rate_limited', status: 429, details: 'Slow down.' }, 429);

/** A client on a fake clock: `sleep` records and advances time, `fetch` replays `responses`. */
function setup(responses: (Response | Error)[], latencyMs = 0) {
  let time = 10_000;
  const sleeps: number[] = [];
  const requests: { url: string; init?: RequestInit; at: number }[] = [];
  const statuses: ClientStatus[] = [];
  const hooks: { onSleep?: (ms: number) => void | Promise<void> } = {};
  const client = createClient({
    now: () => time,
    sleep: async (ms, signal) => {
      sleeps.push(ms);
      await hooks.onSleep?.(ms);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      time += ms;
    },
    fetch: async (input, init) => {
      requests.push({ url: String(input), init, at: time });
      time += latencyMs;
      const next = responses.shift();
      if (!next) throw new Error(`unexpected request ${String(input)}`);
      if (next instanceof Error) throw next;
      return next;
    },
    onStatus: (s) => statuses.push(s),
  });
  return { client, sleeps, requests, statuses, hooks };
}

afterEach(() => {
  vi.useRealTimers();
});

test('spaces /cards/search requests at least 500 ms apart', async () => {
  const { client, sleeps, requests } = setup([json({}), json({})]);
  await Promise.all([client.get('/cards/search?q=a'), client.get('/cards/search?q=a')]);
  expect(requests.map((r) => r.url)).toEqual([`${API}/cards/search?q=a`, `${API}/cards/search?q=a`]);
  expect(sleeps).toEqual([500]);
  expect(requests[1].at - requests[0].at).toBeGreaterThanOrEqual(500);
});

test('spaces other requests 100 ms apart', async () => {
  // A 30 ms request leaves 70 ms to wait: spacing counts from the previous start.
  const { client, sleeps, requests } = setup([json({}), json({})], 30);
  await client.get('/sets/neo');
  await client.get('/sets/neo');
  expect(sleeps).toEqual([70]);
  expect(requests[1].at - requests[0].at).toBeGreaterThanOrEqual(100);
});

test('spacingFor matches the 2/s endpoints by pathname', () => {
  for (const path of ['/cards/search?q=a', '/cards/named?exact=x', '/cards/random', '/cards/collection']) {
    expect(spacingFor(path)).toBe(500);
  }
  expect(spacingFor(`${API}/cards/search?page=2&q=e%3Aneo`)).toBe(500);
  expect(spacingFor('/cards/neo/1')).toBe(100);
  expect(spacingFor('/sets')).toBe(100);
  expect(spacingFor(`${API}/sets/neo?next=/cards/search`)).toBe(100);
});

test('sends Accept and no User-Agent', async () => {
  const { client, requests } = setup([json({})]);
  await client.get('/sets/neo');
  expect(requests[0].init?.headers).toStrictEqual({ Accept: 'application/json' });
});

test('pauses 30 s after a 429 and retries', async () => {
  const { client, sleeps, requests, statuses } = setup([tooMany(), json({ code: 'neo' })]);
  await expect(client.get('/sets/neo')).resolves.toEqual({ code: 'neo' });
  expect(sleeps).toEqual([30_000]);
  expect(requests).toHaveLength(2);
  expect(statuses).toEqual([{ kind: 'rate-limited', resumeAt: 40_000 }, { kind: 'ok' }]);
});

test('gives up after 2 retries', async () => {
  const { client, sleeps, requests } = setup([tooMany(), tooMany(), tooMany()]);
  const err = await client.get('/sets/neo').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ScryfallApiError);
  expect(err).toMatchObject({ status: 429 });
  expect(sleeps).toEqual([30_000, 30_000]);
  expect(requests).toHaveLength(3);
});

test('setStatusListener replaces the status callback', async () => {
  const { client, statuses } = setup([tooMany(), json({}), tooMany(), json({})]);
  const seen: ClientStatus[] = [];
  client.setStatusListener((s) => seen.push(s));
  await client.get('/sets/neo');
  client.setStatusListener();
  await client.get('/sets/neo');
  expect(statuses).toEqual([]);
  expect(seen.map((s) => s.kind)).toEqual(['rate-limited', 'ok']);
});

test('follows next_page until has_more is false', async () => {
  const page2 = `${API}/cards/search?format=json&page=2&q=e%3Aneo&unique=prints`;
  const { client, sleeps, requests } = setup([
    json({ object: 'list', total_cards: 3, has_more: true, next_page: page2, data: [{ id: 'a' }, { id: 'b' }] }),
    json({ object: 'list', total_cards: 3, has_more: false, data: [{ id: 'c' }] }),
  ]);
  const progress: [number, number | undefined][] = [];
  const cards = await client.getAll('/cards/search?q=e:neo', undefined, (n, total) => progress.push([n, total]));
  expect(cards).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  expect(requests.map((r) => r.url)).toEqual([`${API}/cards/search?q=e:neo`, page2]);
  expect(progress).toEqual([
    [2, 3],
    [3, 3],
  ]);
  // The absolute next_page URL is still spaced as a search.
  expect(sleeps).toEqual([500]);
});

const noMatches = { object: 'error', code: 'not_found', status: 404, details: 'Your query didn’t match any cards.' };

test('returns an empty list for a 404 on /cards/search', async () => {
  const { client } = setup([json(noMatches, 404)]);
  await expect(client.getAll('/cards/search?q=e:zzz')).resolves.toEqual([]);
});

test('a 404 on a later search page is an error, not an empty list', async () => {
  const page2 = `${API}/cards/search?page=2&q=e%3Aneo`;
  const { client } = setup([
    json({ object: 'list', has_more: true, next_page: page2, data: [{ id: 'a' }] }),
    json(noMatches, 404),
  ]);
  await expect(client.getAll('/cards/search?q=e:neo')).rejects.toBeInstanceOf(ScryfallApiError);
});

test('throws ScryfallApiError with details for other errors', async () => {
  const body = { object: 'error', status: 404, code: 'not_found', details: 'No set found' };
  const { client } = setup([json(body, 404), json(body, 404)]);
  const err = await client.get('/sets/xyz').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ScryfallApiError);
  expect(err).toMatchObject({ message: 'No set found', status: 404, code: 'not_found' });
  await expect(client.getAll('/sets/xyz')).rejects.toThrow('No set found');
});

test('uses a generic message when the error body is not a Scryfall error', async () => {
  const { client } = setup([new Response('<html>Bad gateway</html>', { status: 502 })]);
  const err = await client.get('/sets/neo').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ScryfallApiError);
  expect(err).toMatchObject({ message: 'Scryfall request failed (HTTP 502).', status: 502, code: undefined });
});

test('passes network errors through without retrying', async () => {
  const failure = new TypeError('Failed to fetch');
  const { client, requests } = setup([failure]);
  await expect(client.get('/sets/neo')).rejects.toBe(failure);
  expect(requests).toHaveLength(1);
});

test('aborting during a 429 pause rejects with AbortError and sends no further request', async () => {
  const controller = new AbortController();
  const { client, requests, hooks } = setup([tooMany(), json({})]);
  hooks.onSleep = () => controller.abort();
  const err = await client.get('/sets/neo', controller.signal).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(DOMException);
  expect(err).toMatchObject({ name: 'AbortError' });
  expect(requests).toHaveLength(1);
});

test('a later call still waits out the 429 pause after an abort', async () => {
  const controller = new AbortController();
  const { client, requests, hooks } = setup([tooMany(), json({ code: 'neo' })]);
  hooks.onSleep = () => controller.abort();
  await client.get('/sets/neo', controller.signal).catch(() => undefined);
  hooks.onSleep = undefined;
  await expect(client.get('/sets/neo')).resolves.toEqual({ code: 'neo' });
  expect(requests[1].at - requests[0].at).toBeGreaterThanOrEqual(30_000);
});

test('aborting a queued call rejects it at once and never sends it', { timeout: 1_000 }, async () => {
  // 100 ms requests leave no spacing to sleep through when the aborted call's turn
  // comes, so only the check before sending can stop it.
  const { client, requests, hooks } = setup([tooMany(), json({})], 100);
  // The first call stays in its 429 pause until released, so the other calls can
  // only reject while they wait behind it (a late rejection would time out).
  const controller = new AbortController();
  let release = () => {};
  hooks.onSleep = () => {
    controller.abort();
    return new Promise<void>((resolve) => (release = resolve));
  };
  const first = client.get('/sets/neo');
  await expect(client.get('/sets/dmu', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await expect(client.get('/sets/m21', AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
  release();
  await first;
  expect(requests.map((r) => r.url)).toEqual([`${API}/sets/neo`, `${API}/sets/neo`]);
});

test('the default sleep stops on abort and clears its timer', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const fetch = vi.fn(async () => tooMany());
  const client = createClient({ fetch });
  const result = client.get('/sets/neo', controller.signal).catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(vi.getTimerCount()).toBe(1);
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(vi.getTimerCount()).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});
