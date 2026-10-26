import { describe, it, expect } from 'vitest';
import { resolveLoadedCards, CARD_SET_VERSION } from './cardDatabase';
import { STAR_WARS_SET } from '../data/starWarsSet';
import { Card } from '../types/card';

const swtg: Card = { id: 's1', name: 'Set Card', type: 'Creature', rarity: 'C', text: '', source: 'swtg-old' };
const custom: Card = { id: 'c1', name: 'Custom', type: 'Creature', rarity: 'C', text: '' };
const scryfall: Card = { id: 'scry:1', name: 'Imported', type: 'Creature', rarity: 'C', text: '', source: 'scryfall:neo' };

describe('resolveLoadedCards', () => {
  it('returns the built-in set when nothing is saved', () => {
    expect(resolveLoadedCards(null, 1)).toEqual({ cards: STAR_WARS_SET.cards, keptCustom: null });
  });

  it('keeps saved cards when the version matches', () => {
    const saved = [swtg, custom];
    expect(resolveLoadedCards(saved, CARD_SET_VERSION)).toEqual({ cards: saved, keptCustom: null });
  });

  it('rebases custom and Scryfall cards onto the new set when the version is older', () => {
    const result = resolveLoadedCards([swtg, custom, scryfall], 1);
    expect(result.keptCustom).toBe(2);
    expect(result.cards).toEqual([custom, scryfall, ...STAR_WARS_SET.cards]);
  });
});
