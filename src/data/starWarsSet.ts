import rawCards from './rawCards.json';
import { Card, CardSet, CardColor } from '../types/card';
import { determineColors } from '../utils/cardHelpers';

export const STAR_WARS_SET: CardSet = {
  id: 'swtg-core',
  name: 'Star Wars TCG Core & Expansions',
  code: 'SWTG',
  description: 'Original Star Wars custom TCG card set including Base set, TFA, and Rogue One expansions.',
  cards: (rawCards as any[]).map((raw, idx) => {
    const colors = determineColors(raw.cost, raw.type);
    return {
      id: `card-${idx + 1}-${raw.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: raw.name,
      cost: raw.cost || '',
      type: raw.type,
      text: raw.text || '',
      flavorText: raw.flavorText || '',
      powerToughness: raw.powerToughness || '',
      rarity: raw.rarity || 'C',
      artist: raw.artist || '',
      source: raw.source || '',
      colors,
    } as Card;
  }),
};
