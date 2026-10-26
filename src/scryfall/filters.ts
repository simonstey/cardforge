import type { ScryfallCard } from './types';

export interface ImportOptions {
  boosterOnly: boolean;
  includeTokens: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { boosterOnly: true, includeTokens: false };

/** Decides whether an import keeps a card. Token-set cards ignore `boosterOnly`. */
export function shouldImport(card: ScryfallCard, opts: ImportOptions, isToken: boolean): boolean {
  if (card.games && !card.games.includes('paper')) return false;
  if (!isToken && opts.boosterOnly && card.booster !== true) return false;
  return true;
}
