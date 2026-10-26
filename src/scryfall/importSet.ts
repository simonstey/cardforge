import type { Card, Rarity } from '../types/card';
import type { CardStore } from '../utils/storage';
import { ScryfallApiError, type ScryfallClient } from './client';
import { shouldImport, type ImportOptions } from './filters';
import { KNOWN_LAYOUTS, mapCard, type MapContext } from './mapCard';
import { syncImported, type SyncResult } from './merge';
import type { ScryfallCard, ScryfallSet } from './types';

/** Set types with booster products; the set picker offers only these (spec 6.6). */
export const IMPORTABLE_SET_TYPES: readonly string[] = ['core', 'expansion', 'masters', 'draft_innovation', 'funny'];

const SET_LIST_KEY = 'scryfallSets';
const SET_LIST_MAX_AGE_MS = 86_400_000;
const RARITIES: readonly Rarity[] = ['C', 'U', 'R', 'M', 'L', 'T'];

type Progress = (fetched: number, total?: number) => void;

/** Every Scryfall set, from a 24 h cache when it has one. A broken cache only costs a refetch. */
export async function getSetList(
  client: ScryfallClient,
  cache: Pick<CardStore, 'getCache' | 'setCache'>,
  signal?: AbortSignal,
): Promise<ScryfallSet[]> {
  try {
    const cached = await cache.getCache<ScryfallSet[]>(SET_LIST_KEY, SET_LIST_MAX_AGE_MS);
    if (Array.isArray(cached)) return cached;
  } catch (err) {
    console.warn('Ignoring the unreadable Scryfall set list cache', err);
  }
  const sets = await client.getAll<ScryfallSet>('/sets', signal);
  try {
    await cache.setCache(SET_LIST_KEY, sets);
  } catch (err) {
    console.warn('Could not cache the Scryfall set list', err);
  }
  return sets;
}

/** The sets the picker offers: paper sets of an importable type, newest first. */
export function importableSets(sets: ScryfallSet[]): ScryfallSet[] {
  return sets
    .filter((s) => !s.digital && IMPORTABLE_SET_TYPES.includes(s.set_type))
    .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''));
}

export const normalizeSetCode = (input: string): string => input.trim().toLowerCase();

/** The token set Scryfall files under `code` (e.g. `tneo` for `neo`), if any. */
export function tokenSetFor(code: string, sets: ScryfallSet[]): ScryfallSet | undefined {
  return sets.find((s) => s.parent_set_code === code && s.set_type === 'token');
}

/** One set's fetched printings, ready for `buildPreview`. */
export interface ImportTarget {
  code: string;
  name: string;
  cards: ScryfallCard[];
  tokens: ScryfallCard[];
}

const unknownSet = (code: string) => new ScryfallApiError(`No Scryfall set with code “${code}”.`, 404, 'not_found');

/** A set from the cached list, else from `/sets/<code>`; a 404 becomes a readable error. */
async function resolveSet(code: string, sets: ScryfallSet[], client: ScryfallClient, signal?: AbortSignal) {
  const listed = sets.find((s) => s.code === code);
  if (listed) return listed;
  // `/sets/` is the whole list, not a set.
  if (!code) throw unknownSet(code);
  try {
    return await client.get<ScryfallSet>(`/sets/${encodeURIComponent(code)}`, signal);
  } catch (err) {
    if (err instanceof ScryfallApiError && err.status === 404) throw unknownSet(code);
    throw err;
  }
}

/** Every printing in a set, following pages; a set with no cards is an empty list. */
function fetchPrints(client: ScryfallClient, code: string, signal?: AbortSignal, onPage?: Progress) {
  const q = encodeURIComponent(`e:${code}`);
  return client.getAll<ScryfallCard>(`/cards/search?q=${q}&unique=prints&order=set`, signal, onPage);
}

/**
 * Resolves a typed or picked set code and fetches its cards, plus its token set when
 * `opts.includeTokens` (spec 6.6). Any failure or abort rejects; nothing partial is returned.
 */
export async function fetchSetTarget(
  input: string,
  opts: ImportOptions,
  deps: { client: ScryfallClient; sets: ScryfallSet[]; signal?: AbortSignal; onProgress?: Progress },
): Promise<ImportTarget> {
  const { client, sets, signal, onProgress } = deps;
  const set = await resolveSet(normalizeSetCode(input), sets, client, signal);
  const cards = await fetchPrints(client, set.code, signal, onProgress);
  const tokenSet = opts.includeTokens ? tokenSetFor(set.code, sets) : undefined;
  // Tokens continue the set's count, so progress never goes backwards.
  const tokens = tokenSet
    ? await fetchPrints(client, tokenSet.code, signal, (fetched, total) =>
        onProgress?.(cards.length + fetched, total === undefined ? undefined : cards.length + total),
      )
    : [];
  return { code: set.code, name: set.name, cards, tokens };
}

/** What a confirmed import would do, computed before anything is saved (spec 6.6 step 4). */
export interface ImportPreview {
  targets: { code: string; name: string }[];
  incoming: Card[];
  byRarity: Record<Rarity, number>;
  skipped: number;
  warnings: string[];
  sync: SyncResult;
}

/**
 * Filters and maps the fetched cards, then syncs them against `existing`. Pure. Tokens take
 * their parent set's code and name; cards `mapCard` can't represent count as skipped.
 */
export function buildPreview(
  targets: ImportTarget[],
  opts: ImportOptions,
  existing: Card[],
  importedAt: string,
): ImportPreview {
  const incoming: Card[] = [];
  const unknownLayouts = new Set<string>();
  let unfamiliar = 0;
  let skipped = 0;

  const add = (card: ScryfallCard, isToken: boolean, ctx: MapContext) => {
    if (!shouldImport(card, opts, isToken)) return;
    const mapped = mapCard(card, ctx);
    if (!mapped) {
      skipped++;
      return;
    }
    if (!KNOWN_LAYOUTS.has(card.layout)) {
      unfamiliar++;
      unknownLayouts.add(card.layout);
    }
    incoming.push(mapped);
  };

  for (const target of targets) {
    const ctx: MapContext = { setCode: target.code.toUpperCase(), setName: target.name, importedAt };
    for (const card of target.cards) add(card, false, ctx);
    for (const card of target.tokens) add(card, true, ctx);
  }

  const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const card of incoming) byRarity[card.rarity]++;

  const layouts = [...unknownLayouts].join(', ');
  const warnings = unfamiliar
    ? [`${unfamiliar} cards have an unfamiliar layout (${layouts}) and were imported as normal cards.`]
    : [];

  return {
    targets: targets.map(({ code, name }) => ({ code, name })),
    incoming,
    byRarity,
    skipped,
    warnings,
    sync: syncImported(existing, incoming, targets.map((t) => t.code.toUpperCase())),
  };
}
