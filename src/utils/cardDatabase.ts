import { Card } from '../types/card';
import { STAR_WARS_SET } from '../data/starWarsSet';

/** Bump when the built-in card set changes; databases saved with an older set are rebased onto the new one. */
export const CARD_SET_VERSION = 2;

/** Built-in set cards come from the SWTG PDFs; anything else was created or imported by the user. */
export const isSetCard = (card: Card) => (card.source ?? '').startsWith('swtg-');

/**
 * Turn the saved card database into the working one. A database saved with an older built-in set
 * keeps the user's own cards and takes the current set for everything else.
 */
export function resolveLoadedCards(
  saved: Card[] | null,
  version: number
): { cards: Card[]; keptCustom: number | null } {
  if (!saved || saved.length === 0) return { cards: STAR_WARS_SET.cards, keptCustom: null };
  if (version === CARD_SET_VERSION) return { cards: saved, keptCustom: null };
  const custom = saved.filter(c => !isSetCard(c));
  return { cards: [...custom, ...STAR_WARS_SET.cards], keptCustom: custom.length };
}
