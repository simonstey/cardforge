export type Rarity = 'C' | 'U' | 'R' | 'M' | 'L' | 'T';

export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'Colorless' | 'Multicolor';

/** The second face of a double-faced card. */
export interface CardFace {
  name: string;
  type: string;
  text?: string;
  flavorText?: string;
  powerToughness?: string;
  /** Mana cost of this face; MDFC/transform/split/adventure faces carry their own. */
  cost?: string;
}

/** Remote Scryfall image URLs: `art` crops to the art window, `full` is the whole card. */
export interface ScryfallImage {
  art?: string;
  full?: string;
  artBack?: string;
  fullBack?: string;
}

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
  /** Present on double-faced cards. Rules text uses {T}, {2}, {R} … for symbols. */
  backFace?: CardFace;
  /** Artwork lookup key (`source::name`) fixed at set creation, so renaming a card keeps its art. */
  artKey?: string;
  /** User-supplied artwork for custom cards. */
  customImageUrl?: string;
  /** Set code (Scryfall code, upper-cased, e.g. 'NEO'); wins over the source-derived code. */
  setCode?: string;
  /** Set name, e.g. 'Kamigawa: Neon Dynasty'. */
  setName?: string;
  /** String because of values like '213★' or 'DSC-300'. */
  collectorNumber?: string;
  /** Provenance and remote images of a card imported from Scryfall. */
  scryfall?: {
    id: string;
    oracleId?: string;
    /** scryfall_uri, for "View on Scryfall". */
    uri?: string;
    layout?: string;
    image?: ScryfallImage;
    /** ISO timestamp. */
    importedAt: string;
    /** Set by the editor; protects the card from being overwritten by a re-import. */
    userModified?: boolean;
  };
}

export interface BoosterSlotConfig {
  commonsCount: number;
  uncommonsCount: number;
  raresCount: number;
  mythicRatio: number; // e.g. 0.22 (roughly 1 in 4.5)
  basicLandCount: number;
  tokenCount: number;
  balanceColorsInCommons: boolean; // ensures all 5 colors represented when commons >= 5
  /** Chance (0–1) that a pack contains a foil, which replaces one common. Default 0 (off). */
  foilRate?: number;
  /** Set codes (see getCardSetCode) to draw from. Missing, empty, or matching no cards = all sets. */
  includedSets?: string[];
}

export interface BoosterPack {
  id: string;
  packNumber: number;
  cards: Card[];
  /** True when a rare/mythic slot produced a mythic. */
  hasMythic: boolean;
  /** Partition: each card counted once under W/U/B/R/G (mono), Multicolor or Colorless. */
  colorCounts: Record<string, number>;
  /** Cards containing each color; multicolor cards count under each of their colors. */
  colorPresence?: Record<'W' | 'U' | 'B' | 'R' | 'G', number>;
  /** Mythics produced by the rare/mythic slots. */
  mythicCount?: number;
  /** Ids of the foil card(s) in `cards`. */
  foilCardIds?: string[];
}

export interface CardSet {
  id: string;
  name: string;
  code: string;
  description?: string;
  cards: Card[];
}
