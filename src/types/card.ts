export type Rarity = 'C' | 'U' | 'R' | 'M' | 'L' | 'T';

export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'Colorless' | 'Multicolor';

export interface Card {
  id: string;
  name: string;
  cost?: string;
  type: string;
  text?: string;
  flavorText?: string;
  powerToughness?: string;
  rarity: Rarity; // 'C' = Common, 'U' = Uncommon, 'R' = Rare, 'M' = Mythic, 'L' = Basic Land, 'T' = Token
  artist?: string;
  source?: string;
  colors?: CardColor[];
  customImageUrl?: string;
}

export interface BoosterSlotConfig {
  commonsCount: number;
  uncommonsCount: number;
  raresCount: number;
  mythicRatio: number; // e.g. 0.22 (roughly 1 in 4.5)
  basicLandCount: number;
  tokenCount: number;
  balanceColorsInCommons: boolean; // ensures all 5 colors represented when commons >= 5
}

export interface BoosterPack {
  id: string;
  packNumber: number;
  cards: Card[];
  hasMythic: boolean;
  colorCounts: Record<string, number>;
}

export interface CardSet {
  id: string;
  name: string;
  code: string;
  description?: string;
  cards: Card[];
}
