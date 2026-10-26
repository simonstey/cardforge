import { resolveTokenParents, type BulkSetSummary } from './bulkStream';
import type { ImportTarget } from './importSet';
import type { ScryfallCard, ScryfallSet } from './types';

/** A set the bulk tab offers, with the token sets that import alongside it. */
export interface BulkSetOption extends BulkSetSummary {
  /** Token sets filed under this set, in file order. */
  tokenCodes: string[];
  /** Cards in those token sets. */
  tokenCount: number;
}

/**
 * The sets a scanned bulk file offers, by name. The token set the API path would fetch for a set in
 * the file (`tokenSetFor`) folds into that set (it imports through "Include tokens"); any other token
 * set, such as substitute cards, is listed as a set of its own. `known` is the `/sets` list, when there
 * is one (spec 6.12).
 */
export function bulkSetOptions(summaries: BulkSetSummary[], known?: ScryfallSet[]): BulkSetOption[] {
  const parents = resolveTokenParents(summaries, known);
  const present = new Set(summaries.map(s => s.code));
  // A parent that is itself a folded token set doesn't take children: folding stays one level deep.
  const parentOf = (code: string) => {
    const parent = parents.get(code);
    return parent !== undefined && present.has(parent) && !parents.has(parent) ? parent : undefined;
  };

  const options = new Map<string, BulkSetOption>();
  for (const s of summaries) {
    if (parentOf(s.code) === undefined) options.set(s.code, { ...s, tokenCodes: [], tokenCount: 0 });
  }
  for (const s of summaries) {
    const parent = options.get(parentOf(s.code) ?? '');
    if (!parent) continue;
    parent.tokenCodes.push(s.code);
    parent.tokenCount += s.count;
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

/** The set codes a collect pass reads for the chosen sets. */
export function collectCodes(chosen: BulkSetOption[], includeTokens: boolean): string[] {
  return chosen.flatMap(o => (includeTokens ? [o.code, ...o.tokenCodes] : [o.code]));
}

const byCollectorNumber = (cards: ScryfallCard[]) =>
  cards.sort((a, b) => a.collector_number.localeCompare(b.collector_number, 'en', { numeric: true }));

/**
 * Groups a collect pass's cards into one import target per chosen set, so they go through the same
 * `buildPreview` as the API path. To match what `/cards/search?…&order=set` returns, cards are in
 * collector-number order and variations are left out. A token set picked on its own imports as tokens.
 */
export function bulkTargets(chosen: BulkSetOption[], cards: ScryfallCard[], includeTokens: boolean): ImportTarget[] {
  const bySet = new Map<string, ScryfallCard[]>();
  for (const card of cards) {
    if (card.variation) continue;
    const list = bySet.get(card.set);
    if (list) list.push(card);
    else bySet.set(card.set, [card]);
  }
  const cardsOf = (code: string) => byCollectorNumber(bySet.get(code) ?? []);

  return chosen.map(({ code, name, setType, tokenCodes }) => {
    const own = cardsOf(code);
    const tokens = includeTokens ? tokenCodes.flatMap(cardsOf) : [];
    return setType === 'token' ? { code, name, cards: [], tokens: [...own, ...tokens] } : { code, name, cards: own, tokens };
  });
}
