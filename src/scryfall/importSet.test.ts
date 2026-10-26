import { afterEach, expect, test, vi } from 'vitest';
import type { Card } from '../types/card';
import { bulkSetOptions, bulkTargets, collectCodes } from './bulkSets';
import type { BulkSetSummary } from './bulkStream';
import { ScryfallApiError, type ScryfallClient } from './client';
import { DEFAULT_IMPORT_OPTIONS, type ImportOptions } from './filters';
import {
  buildPreview,
  fetchSetTarget,
  getSetList,
  IMPORTABLE_SET_TYPES,
  importableSets,
  normalizeSetCode,
  type ImportTarget,
} from './importSet';
import { tokenSetFor } from './tokenSets';
import type { ScryfallCard, ScryfallList, ScryfallSet } from './types';
import artSeries from './__fixtures__/art-series.json';
import basic from './__fixtures__/basic.json';
import normal from './__fixtures__/normal.json';
import token from './__fixtures__/token.json';

const NOW = '2026-10-26T00:00:00.000Z';
const ALL: ImportOptions = { boosterOnly: false, includeTokens: true };
const WITH_TOKENS: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, includeTokens: true };

const set = (over: Partial<ScryfallSet>): ScryfallSet => ({
  code: 'neo',
  name: 'Kamigawa: Neon Dynasty',
  set_type: 'expansion',
  released_at: '2022-02-18',
  card_count: 512,
  digital: false,
  search_uri: 'https://api.scryfall.com/cards/search?q=e:neo',
  ...over,
});
const NEO = set({});
const TNEO = set({
  code: 'tneo', name: 'Kamigawa: Neon Dynasty Tokens', set_type: 'token', parent_set_code: 'neo', card_count: 20,
});
/** Also a token-type child of NEO, but substitute cards for the double-faced ones, not tokens. */
const SNEO = set({
  code: 'sneo', name: 'Kamigawa: Neon Dynasty Substitute Cards', set_type: 'token', parent_set_code: 'neo', card_count: 9,
});

/** A NEO printing built on the Lightning Bolt fixture. */
const neo = (id: string, over: Partial<ScryfallCard> = {}): ScryfallCard => ({
  ...(normal as ScryfallCard),
  id,
  set: 'neo',
  set_name: 'Kamigawa: Neon Dynasty',
  set_type: 'expansion',
  ...over,
});

const list = <T>(data: T[], next?: string, total = data.length): ScryfallList<T> => ({
  object: 'list', data, has_more: !!next, next_page: next, total_cards: total,
});

const search = (code: string) => `/cards/search?q=e:${code}&unique=prints&order=set`;
const PAGE_2 = '/cards/search?page=2&q=e:neo&unique=prints&order=set';

/**
 * A client that replays `routes` (decoded URL → response, or an Error to reject with). Like the
 * real client, it follows `next_page`, turns a 404 on a search's first page into an empty list, and
 * rejects with an AbortError before any request once aborted.
 */
function stubClient(routes: Map<string, unknown>) {
  const requests: string[] = [];
  function reply(url: string, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const key = decodeURIComponent(url);
    requests.push(key);
    if (!routes.has(key)) return Promise.reject(new Error(`unexpected request ${key}`));
    const res = routes.get(key);
    return res instanceof Error ? Promise.reject(res) : Promise.resolve(res);
  }
  const client: ScryfallClient = {
    get: <T>(url: string, signal?: AbortSignal) => reply(url, signal) as Promise<T>,
    async getAll<T>(url: string, signal?: AbortSignal, onPage?: (fetched: number, total?: number) => void) {
      const items: T[] = [];
      let next: string | null | undefined = url;
      while (next) {
        const first = next === url;
        const page = (await reply(next, signal).catch((err: unknown) => {
          const notFound = err instanceof ScryfallApiError && err.status === 404;
          if (notFound && first && url.startsWith('/cards/search')) return list<T>([]);
          throw err;
        })) as ScryfallList<T>;
        items.push(...page.data);
        onPage?.(items.length, page.total_cards);
        next = page.has_more ? page.next_page : undefined;
      }
      return items;
    },
    setStatusListener: () => undefined,
  };
  return { client, requests };
}

/** A `CardStore` cache on a clock the test moves by hand. */
function memoryCache() {
  const clock = { now: 0 };
  const entries = new Map<string, { savedAt: number; value: unknown }>();
  const cache = {
    async getCache<T>(key: string, maxAgeMs: number) {
      const entry = entries.get(key);
      return entry && clock.now - entry.savedAt <= maxAgeMs ? (entry.value as T) : undefined;
    },
    async setCache(key: string, value: unknown) {
      entries.set(key, { savedAt: clock.now, value });
    },
  };
  return { cache, clock, entries };
}

const target = (over: Partial<ImportTarget> = {}): ImportTarget => ({
  code: 'neo', name: 'Kamigawa: Neon Dynasty', cards: [], tokens: [], ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('importableSets filters digital and non-booster set types', () => {
  expect(IMPORTABLE_SET_TYPES).toEqual(['core', 'expansion', 'masters', 'draft_innovation', 'funny']);
  const sets = [
    set({ code: 'm10', set_type: 'core', released_at: '2009-07-17' }),
    NEO,
    TNEO,
    set({ code: '2x2', set_type: 'masters', released_at: '2022-07-08' }),
    set({ code: 'ymid', set_type: 'alchemy', digital: true, released_at: '2021-12-09' }),
    set({ code: 'prm', set_type: 'promo', released_at: '2023-01-01' }),
    set({ code: 'cmr', set_type: 'draft_innovation', released_at: '2020-11-20' }),
    set({ code: 'unf', set_type: 'funny', released_at: '2023-04-07' }),
    set({ code: 'xyz', set_type: 'expansion', digital: true, released_at: '2024-01-01' }),
  ];
  expect(importableSets(sets).map((s) => s.code)).toEqual(['unf', '2x2', 'neo', 'cmr', 'm10']);
  expect(sets[0].code).toBe('m10');
});

test('getSetList uses the cache for 24 h', async () => {
  const { client, requests } = stubClient(new Map([['/sets', list([NEO, TNEO])]]));
  const { cache, clock, entries } = memoryCache();

  expect(await getSetList(client, cache)).toEqual([NEO, TNEO]);
  expect(requests).toEqual(['/sets']);
  expect(entries.get('scryfallSets')?.value).toEqual([NEO, TNEO]);

  clock.now = 86_400_000;
  expect(await getSetList(client, cache)).toEqual([NEO, TNEO]);
  expect(requests).toHaveLength(1);

  clock.now = 86_400_001;
  await getSetList(client, cache);
  expect(requests).toEqual(['/sets', '/sets']);
});

test('getSetList treats a failing cache as a miss', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { client, requests } = stubClient(new Map([['/sets', list([NEO])]]));
  const broken = {
    getCache: () => Promise.reject(new Error('corrupt entry')),
    setCache: () => Promise.reject(new Error('QuotaExceededError')),
  };
  expect(await getSetList(client, broken)).toEqual([NEO]);
  expect(requests).toEqual(['/sets']);
  expect(warn).toHaveBeenCalledTimes(2);
});

test('normalizes typed set codes', async () => {
  expect(normalizeSetCode(' NEO ')).toBe('neo');
  const routes = new Map<string, unknown>([[search('neo'), list([neo('a')])], ['/sets/neo', NEO]]);

  const { client, requests } = stubClient(routes);
  const found = await fetchSetTarget(' NEO ', DEFAULT_IMPORT_OPTIONS, { client, sets: [NEO, TNEO] });
  expect(found).toEqual({ code: 'neo', name: 'Kamigawa: Neon Dynasty', cards: [neo('a')], tokens: [] });
  expect(requests).toEqual(['/cards/search?q=e:neo&unique=prints&order=set']);

  // A code missing from the cached list is looked up on its own.
  const lookup = stubClient(routes);
  const typed = await fetchSetTarget('Neo', DEFAULT_IMPORT_OPTIONS, { client: lookup.client, sets: [] });
  expect(typed.code).toBe('neo');
  expect(lookup.requests).toEqual(['/sets/neo', search('neo')]);
});

test('unknown set code gives a clear error', async () => {
  const routes = new Map<string, unknown>([
    ['/sets/xyz', new ScryfallApiError('No set found for the given code.', 404, 'not_found')],
    ['/sets/abc', new ScryfallApiError('Scryfall request failed (HTTP 500).', 500)],
  ]);
  const { client, requests } = stubClient(routes);

  const err = await fetchSetTarget(' XYZ', DEFAULT_IMPORT_OPTIONS, { client, sets: [NEO] }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ScryfallApiError);
  expect(err).toMatchObject({ message: 'No Scryfall set with code “xyz”.', status: 404 });
  expect(requests).toEqual(['/sets/xyz']);

  // Other failures pass through unchanged.
  const serverError = routes.get('/sets/abc');
  await expect(fetchSetTarget('abc', DEFAULT_IMPORT_OPTIONS, { client, sets: [] })).rejects.toBe(serverError);

  // An empty code is never sent: `/sets/` is the set list, not a set.
  requests.length = 0;
  await expect(fetchSetTarget('  ', DEFAULT_IMPORT_OPTIONS, { client, sets: [] })).rejects.toThrow(
    'No Scryfall set with code “”.',
  );
  expect(requests).toEqual([]);
});

test('fetches tokens from the token set when requested', async () => {
  const routes = new Map<string, unknown>([
    [search('neo'), list([neo('a'), neo('b')])],
    [search('tneo'), list([token])],
    [search('m10'), list([normal])],
  ]);
  const M10 = set({ code: 'm10', name: 'Magic 2010', set_type: 'core' });
  const sets = [NEO, TNEO, M10];
  expect(tokenSetFor('neo', sets)).toBe(TNEO);
  expect(tokenSetFor('m10', sets)).toBeUndefined();

  const withTokens = stubClient(routes);
  const progress: [number, number?][] = [];
  const onProgress = (fetched: number, total?: number) => progress.push([fetched, total]);
  const found = await fetchSetTarget('neo', WITH_TOKENS, { client: withTokens.client, sets, onProgress });
  expect(found.tokens).toEqual([token]);
  expect(found.cards).toEqual([neo('a'), neo('b')]);
  expect(withTokens.requests).toEqual([search('neo'), search('tneo')]);
  // One running count across the set and its tokens.
  expect(progress).toEqual([[2, 2], [3, 3]]);

  const without = stubClient(routes);
  expect((await fetchSetTarget('neo', DEFAULT_IMPORT_OPTIONS, { client: without.client, sets })).tokens).toEqual([]);
  expect(without.requests).toEqual([search('neo')]);

  const noTokenSet = stubClient(routes);
  expect((await fetchSetTarget('m10', WITH_TOKENS, { client: noTokenSet.client, sets })).tokens).toEqual([]);
  expect(noTokenSet.requests).toEqual([search('m10')]);
});

const noMatches = () => new ScryfallApiError('Your query didn’t match any cards.', 404, 'not_found');

/** A token from NEO's token set, and a substitute card from `sneo`, which is a token-type set too. */
const tneoToken = (id: string): ScryfallCard => ({ ...(token as ScryfallCard), id, set: 'tneo', collector_number: id });
const sneoCard = (id: string): ScryfallCard => ({
  ...(token as ScryfallCard),
  id,
  name: 'Substitute card',
  layout: 'normal',
  set: 'sneo',
  set_name: SNEO.name,
  collector_number: id,
});

test('API and bulk import pick the same token set: tneo, never sneo', async () => {
  const neoCards = [neo('a', { collector_number: '1', booster: true }), neo('b', { collector_number: '2', booster: true })];
  const tokens = [tneoToken('t1'), tneoToken('t2')];
  const substitutes = [sneoCard('s1')];
  // `sneo` is listed first, so "the first token-type child" would pick it.
  const sets = [NEO, SNEO, TNEO];

  const { client, requests } = stubClient(
    new Map<string, unknown>([
      [search('neo'), list(neoCards)],
      [search('tneo'), list(tokens)],
      [search('sneo'), list(substitutes)],
    ]),
  );
  const api = await fetchSetTarget('neo', WITH_TOKENS, { client, sets });
  expect(requests).toEqual([search('neo'), search('tneo')]);
  expect(api.tokens).toEqual(tokens);
  const apiIds = buildPreview([api], WITH_TOKENS, [], NOW).incoming.map((c) => c.id);
  expect(apiIds).toEqual(['scry:a', 'scry:b', 'scry:t1', 'scry:t2']);

  const summaries: BulkSetSummary[] = [
    { code: 'sneo', name: SNEO.name, setType: 'token', count: 1 },
    { code: 'neo', name: NEO.name, setType: 'expansion', count: 2 },
    { code: 'tneo', name: TNEO.name, setType: 'token', count: 2 },
  ];
  const file = [...substitutes, ...tokens, ...neoCards];
  // Online (with the set list) and offline (the `t<code>` convention) group the file the same way.
  for (const known of [sets, undefined]) {
    const options = bulkSetOptions(summaries, known);
    expect(options.map((o) => [o.code, o.tokenCodes])).toEqual([
      ['neo', ['tneo']],
      ['sneo', []],
    ]);
    const chosen = options.filter((o) => o.code === 'neo');
    expect(collectCodes(chosen, true)).toEqual(['neo', 'tneo']);
    const targets = bulkTargets(chosen, file, true);
    expect(buildPreview(targets, WITH_TOKENS, [], NOW).incoming.map((c) => c.id)).toEqual(apiIds);
  }
});

test('without a set list, tokens come from probing the t<code> set', async () => {
  const tokens = [tneoToken('t1'), tneoToken('t2')];
  const routes = new Map<string, unknown>([
    ['/sets/neo', NEO],
    [search('neo'), list([neo('a')])],
    [search('tneo'), list(tokens)],
    ['/sets/m10', set({ code: 'm10', name: 'Magic 2010', set_type: 'core' })],
    [search('m10'), list([normal])],
    [search('tm10'), noMatches()],
  ]);

  const probed = stubClient(routes);
  const found = await fetchSetTarget('neo', WITH_TOKENS, { client: probed.client, sets: [] });
  expect(probed.requests).toEqual(['/sets/neo', search('neo'), search('tneo')]);
  expect(found.tokens).toEqual(tokens);

  // No `t<code>` set: the search's 404 is an empty list, not an error.
  const none = stubClient(routes);
  expect((await fetchSetTarget('m10', WITH_TOKENS, { client: none.client, sets: [] })).tokens).toEqual([]);
  expect(none.requests).toEqual(['/sets/m10', search('m10'), search('tm10')]);

  // A `t<code>` set that isn't a token set (`tsp` next to a set `sp`) adds no tokens.
  const notTokens = stubClient(
    new Map<string, unknown>([
      ['/sets/sp', set({ code: 'sp', name: 'Some Set' })],
      [search('sp'), list([neo('a', { set: 'sp' })])],
      [search('tsp'), list([neo('ts', { set: 'tsp', set_type: 'expansion' })])],
    ]),
  );
  expect((await fetchSetTarget('sp', WITH_TOKENS, { client: notTokens.client, sets: [] })).tokens).toEqual([]);

  // Without "Include tokens" there is no probe.
  const off = stubClient(routes);
  await fetchSetTarget('neo', DEFAULT_IMPORT_OPTIONS, { client: off.client, sets: [] });
  expect(off.requests).toEqual(['/sets/neo', search('neo')]);
});

test('a token set fetched on its own imports its cards as tokens', async () => {
  const tokens = [tneoToken('t1'), tneoToken('t2')];
  for (const sets of [[NEO, TNEO], []]) {
    const { client, requests } = stubClient(
      new Map<string, unknown>([
        ['/sets/tneo', TNEO],
        [search('tneo'), list(tokens)],
      ]),
    );
    // Booster-only is on and tokens are never booster cards, yet they import.
    const target = await fetchSetTarget('TNEO', DEFAULT_IMPORT_OPTIONS, { client, sets });
    expect(target).toEqual({ code: 'tneo', name: TNEO.name, cards: [], tokens });
    expect(requests.filter((r) => r.startsWith('/cards/'))).toEqual([search('tneo')]);

    const preview = buildPreview([target], DEFAULT_IMPORT_OPTIONS, [], NOW);
    expect(preview.incoming.map((c) => c.id)).toEqual(['scry:t1', 'scry:t2']);
    expect(preview.byRarity.T).toBe(2);
    expect(preview.incoming[0]).toMatchObject({ setCode: 'TNEO', setName: TNEO.name, source: 'scryfall:tneo' });
  }
});

test('rejects and keeps nothing when a later page fails', async () => {
  const failure = new ScryfallApiError('Scryfall request failed (HTTP 500).', 500);
  const { client, requests } = stubClient(
    new Map<string, unknown>([
      [search('neo'), list([neo('a')], PAGE_2, 2)],
      [PAGE_2, failure],
      [search('tneo'), list([token])],
    ]),
  );
  const onProgress = vi.fn();
  const preview = vi.fn(buildPreview);
  let partial: ImportTarget | undefined;

  const run = fetchSetTarget('neo', WITH_TOKENS, { client, sets: [NEO, TNEO], onProgress }).then((t) => {
    partial = t;
    return preview([t], WITH_TOKENS, [], NOW);
  });

  await expect(run).rejects.toBe(failure);
  expect(onProgress).toHaveBeenCalledWith(1, 2);
  expect(partial).toBeUndefined();
  expect(preview).not.toHaveBeenCalled();
  expect(requests).toEqual([search('neo'), PAGE_2]);
});

test('aborting stops further requests', async () => {
  const routes = new Map<string, unknown>([
    [search('neo'), list([neo('a')], PAGE_2, 2)],
    [PAGE_2, list([neo('b')], undefined, 2)],
    [search('tneo'), list([token])],
  ]);
  const deps = { sets: [NEO, TNEO] };

  // Mid-way through the set, after the set, and before anything was sent.
  for (const [abortAt, sent] of [
    [1, [search('neo')]],
    [2, [search('neo'), PAGE_2]],
    [0, []],
  ] as const) {
    const { client, requests } = stubClient(routes);
    const controller = new AbortController();
    if (abortAt === 0) controller.abort();
    const onProgress = (fetched: number) => fetched === abortAt && controller.abort();

    const run = fetchSetTarget('neo', WITH_TOKENS, { ...deps, client, signal: controller.signal, onProgress });
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests).toEqual(sent);
  }
});

test('buildPreview counts rarities, skips art series and warns on unknown layouts', () => {
  const cards = [
    neo('c', { rarity: 'common' }),
    neo('u', { rarity: 'uncommon' }),
    neo('r', { rarity: 'rare' }),
    basic as ScryfallCard,
    artSeries as ScryfallCard,
    neo('m1', { layout: 'mystery', rarity: 'common' }),
    neo('m2', { layout: 'mystery', rarity: 'common' }),
    neo('o', { layout: 'oddity', rarity: 'rare' }),
  ];
  const preview = buildPreview([target({ cards, tokens: [token] })], ALL, [], NOW);

  expect(preview.targets).toEqual([{ code: 'neo', name: 'Kamigawa: Neon Dynasty' }]);
  expect(preview.incoming).toHaveLength(8);
  expect(preview.byRarity).toEqual({ C: 3, U: 1, R: 2, M: 0, L: 1, T: 1 });
  expect(preview.skipped).toBe(1);
  expect(preview.warnings).toEqual([
    '3 cards have an unfamiliar layout (mystery, oddity) and were imported as normal cards.',
  ]);
  expect(preview.incoming.every((c) => c.setCode === 'NEO' && c.scryfall?.importedAt === NOW)).toBe(true);
  expect(preview.sync).toMatchObject({ added: 8, imported: 8, removed: 0 });

  const plain = buildPreview([target({ cards: [neo('c')] })], ALL, [], NOW);
  expect(plain.warnings).toEqual([]);
  expect(plain.skipped).toBe(0);
});

test('buildPreview assigns tokens to the parent set', () => {
  const offSheet = neo('promo', { booster: false });
  const preview = buildPreview([target({ cards: [neo('a'), offSheet], tokens: [token] })], WITH_TOKENS, [], NOW);

  // Booster-only drops the off-sheet printing but never a token.
  expect(preview.incoming.map((c) => c.id)).toEqual(['scry:a', `scry:${token.id}`]);
  expect(preview.incoming[1]).toMatchObject({
    setCode: 'NEO',
    setName: 'Kamigawa: Neon Dynasty',
    source: 'scryfall:tneo',
    rarity: 'T',
  });
});

test('buildPreview sync reports removals for a narrower re-import', () => {
  const other: Card = {
    id: 'scry:bolt', name: 'Lightning Bolt', type: 'Instant', rarity: 'C', source: 'scryfall:m10',
    setCode: 'M10', scryfall: { id: 'bolt', importedAt: NOW },
  };
  const cards = [neo('a'), neo('b', { booster: false })];
  const first = buildPreview([target({ cards })], ALL, [other], NOW);
  expect(first.sync).toMatchObject({ added: 2, removed: 0 });

  const later = '2026-10-27T00:00:00.000Z';
  const narrower = buildPreview([target({ cards })], DEFAULT_IMPORT_OPTIONS, first.sync.cards, later);
  expect(narrower.sync).toMatchObject({ added: 0, unchanged: 1, updated: 0, removed: 1, protected: 0 });
  expect(narrower.sync.cards.map((c) => c.id)).toEqual(['scry:bolt', 'scry:a']);
});
