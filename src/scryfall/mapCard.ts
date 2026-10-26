import type { Card, CardColor, CardFace, Rarity, ScryfallImage } from '../types/card';
import type { ScryfallCard, ScryfallCardFace, ScryfallImageUris } from './types';

/** The set an imported card belongs to; token-set cards take their parent's (spec 6.3). */
export interface MapContext {
  setCode: string;
  setName: string;
  importedAt: string;
}

/** Layouts `mapCard` handles on purpose; anything else maps like `normal`, with a preview warning. */
export const KNOWN_LAYOUTS: ReadonlySet<string> = new Set([
  'normal', 'split', 'flip', 'transform', 'modal_dfc', 'meld', 'leveler', 'class', 'case', 'saga', 'adventure',
  'mutate', 'prototype', 'battle', 'token', 'double_faced_token', 'emblem', 'augment', 'host', 'reversible_card',
  'prepare',
]);

/** Layouts CardForge can't represent; `mapCard` returns null for them. */
export const SKIPPED_LAYOUTS: ReadonlySet<string> = new Set(['art_series', 'vanguard', 'planar', 'scheme']);

const TOKEN_LAYOUTS: ReadonlySet<string> = new Set(['token', 'double_faced_token', 'emblem']);

const RARITIES: Record<string, Rarity> = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M', special: 'R', bonus: 'R' };

/** Colour letters in the order `determineColors` reports them. */
const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;

/**
 * Double-sided: each face has its own image and the root has none (transform, battles, modal_dfc,
 * reversible_card, double_faced_token). Split, flip and adventure cards share one root image.
 */
export function isDoubleSided(card: ScryfallCard): boolean {
  return !!card.card_faces?.[0]?.image_uris && !card.image_uris;
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

type TextKey =
  | 'name' | 'printed_name' | 'mana_cost' | 'type_line' | 'printed_type_line'
  | 'oracle_text' | 'printed_text' | 'flavor_text' | 'artist';

/** First non-empty value, trying every key on a source before moving to the next source. */
function pick(sources: ScryfallCardFace[], ...keys: TextKey[]): string | undefined {
  for (const source of sources) for (const key of keys) if (source[key]) return source[key];
  return undefined;
}

/** "P/T", else loyalty, else defense (CardForge keeps all three in `powerToughness`). */
function statsOf(source: ScryfallCardFace): string | undefined {
  if (source.power && source.toughness) return `${source.power}/${source.toughness}`;
  return source.loyalty || source.defense || undefined;
}

/**
 * The face fields of a card, each from the first source that has it: face 0, then the root.
 * Non-English cards use their printed name, type and text. A combined split cost ("{1}{R} // {1}{U}")
 * is never a face's cost, and an empty cost (lands, transform backs) is omitted.
 */
function faceOf(sources: ScryfallCardFace[]): CardFace {
  const cost = pick(sources, 'mana_cost');
  const text = pick(sources, 'printed_text', 'oracle_text');
  const flavorText = pick(sources, 'flavor_text');
  const powerToughness = sources.map(statsOf).find(Boolean);
  return {
    name: pick(sources, 'printed_name', 'name') ?? '',
    ...(cost !== undefined && !cost.includes('//') && { cost }),
    type: pick(sources, 'printed_type_line', 'type_line') ?? '',
    ...(text !== undefined && { text }),
    ...(flavorText !== undefined && { flavorText }),
    ...(powerToughness !== undefined && { powerToughness }),
  };
}

function rarityOf(card: ScryfallCard): Rarity {
  if (TOKEN_LAYOUTS.has(card.layout)) return 'T';
  // The English type line, so a localised "Basic Land" still counts.
  const typeLine = card.type_line ?? card.card_faces?.[0]?.type_line ?? '';
  if (/\bBasic\b/.test(typeLine) && /\bLand\b/.test(typeLine)) return 'L';
  return RARITIES[card.rarity] ?? 'C';
}

/** Root colours, else the union of the face colours, in the shape `determineColors` produces. */
function colorsOf(card: ScryfallCard): CardColor[] {
  const raw = card.colors ?? card.card_faces?.flatMap((face) => face.colors ?? []) ?? [];
  const found: CardColor[] = WUBRG.filter((c) => raw.includes(c));
  if (found.length === 0) return ['Colorless'];
  return found.length === 1 ? found : ['Multicolor', ...found];
}

const artOf = (uris?: ScryfallImageUris) => uris?.art || uris?.art_crop || undefined;
// Never `png`: Scryfall forbids hotlinking it from 2027.
const fullOf = (uris?: ScryfallImageUris) => uris?.display || uris?.large || uris?.normal || undefined;

/** Front images from face 0 (double-sided) or the root; back images for double-sided cards only. */
function imageOf(card: ScryfallCard): ScryfallImage | undefined {
  const sided = isDoubleSided(card);
  const front = sided ? card.card_faces?.[0]?.image_uris : card.image_uris;
  const back = sided ? card.card_faces?.[1]?.image_uris : undefined;
  const [art, full, artBack, fullBack] = [artOf(front), fullOf(front), artOf(back), fullOf(back)];
  if (!art && !full && !artBack && !fullBack) return undefined;
  return {
    ...(art !== undefined && { art }),
    ...(full !== undefined && { full }),
    ...(artBack !== undefined && { artBack }),
    ...(fullBack !== undefined && { fullBack }),
  };
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Scryfall card to a CardForge card (spec 6.3), or null for cards CardForge can't represent:
 * skipped layouts and cards with neither a name nor a type line.
 */
export function mapCard(card: ScryfallCard, ctx: MapContext): Card | null {
  if (SKIPPED_LAYOUTS.has(card.layout)) return null;
  const faces = card.card_faces ?? [];
  const sources: ScryfallCardFace[] = faces.length > 0 ? [faces[0], card] : [card];
  const front = faceOf(sources);
  if (!front.name && !front.type) return null;

  const artist = pick(sources, 'artist');
  // Tokens, emblems and anything else fetched from a token set share the parent set's chip.
  const parent = card.set_type === 'token' || TOKEN_LAYOUTS.has(card.layout);
  const oracleId = card.oracle_id ?? faces[0]?.oracle_id;
  const image = imageOf(card);

  return {
    id: `scry:${card.id}`,
    ...front,
    rarity: rarityOf(card),
    ...(artist !== undefined && { artist }),
    source: `scryfall:${card.set.toLowerCase()}`,
    colors: colorsOf(card),
    ...(faces.length >= 2 && { backFace: faceOf([faces[1]]) }),
    setCode: parent ? ctx.setCode : card.set.toUpperCase(),
    setName: parent ? ctx.setName : card.set_name,
    collectorNumber: card.collector_number,
    scryfall: {
      id: card.id,
      ...(oracleId !== undefined && { oracleId }),
      ...(card.scryfall_uri !== undefined && { uri: card.scryfall_uri }),
      layout: card.layout,
      ...(image && { image }),
      importedAt: ctx.importedAt,
    },
  };
}
