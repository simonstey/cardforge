import type { Card, CardColor, CardFace, Rarity, ScryfallImage } from '../types/card';
import { determineColors, MANA_ORDER, RARITY_ORDER } from './cardHelpers';

const VALID_RARITIES = new Set<string>(RARITY_ORDER);
const VALID_COLORS = new Set<string>(MANA_ORDER);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function readBackFace(raw: unknown): CardFace | undefined {
  if (!isRecord(raw) || typeof raw.name !== 'string' || typeof raw.type !== 'string') return undefined;
  const text = str(raw.text);
  const flavorText = str(raw.flavorText);
  const powerToughness = str(raw.powerToughness);
  const cost = str(raw.cost);
  return {
    name: raw.name,
    type: raw.type,
    ...(text !== undefined && { text }),
    ...(flavorText !== undefined && { flavorText }),
    ...(powerToughness !== undefined && { powerToughness }),
    ...(cost !== undefined && { cost }),
  };
}

function readImage(raw: unknown): ScryfallImage | undefined {
  if (!isRecord(raw)) return undefined;
  const image: ScryfallImage = {};
  for (const key of ['art', 'full', 'artBack', 'fullBack'] as const) {
    const value = str(raw[key]);
    if (value !== undefined) image[key] = value;
  }
  return image;
}

function readScryfall(raw: unknown): Card['scryfall'] {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.importedAt !== 'string') return undefined;
  const oracleId = str(raw.oracleId);
  const uri = str(raw.uri);
  const layout = str(raw.layout);
  const image = readImage(raw.image);
  return {
    id: raw.id,
    importedAt: raw.importedAt,
    ...(oracleId !== undefined && { oracleId }),
    ...(uri !== undefined && { uri }),
    ...(layout !== undefined && { layout }),
    ...(image && { image }),
    ...(typeof raw.userModified === 'boolean' && { userModified: raw.userModified }),
  };
}

/** Rebuilds a card from untrusted JSON, coercing the base fields and keeping every optional one. */
export function normalizeImportedCard(item: Record<string, unknown>, index: number, now: number = Date.now()): Card {
  const cost = String(item.cost || '');
  const type = String(item.type || 'Card');
  const colors =
    Array.isArray(item.colors) && item.colors.length > 0 && item.colors.every(c => typeof c === 'string' && VALID_COLORS.has(c))
      ? (item.colors as CardColor[])
      : determineColors(cost, type);
  const backFace = readBackFace(item.backFace);
  const artKey = str(item.artKey);
  const customImageUrl = str(item.customImageUrl);
  const setCode = str(item.setCode);
  const setName = str(item.setName);
  const collectorNumber = str(item.collectorNumber);
  const scryfall = readScryfall(item.scryfall);

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `imported-${now}-${index}`,
    name: String(item.name || 'Untitled Card'),
    cost,
    type,
    text: String(item.text || ''),
    flavorText: String(item.flavorText || ''),
    powerToughness: String(item.powerToughness || ''),
    rarity: (VALID_RARITIES.has(item.rarity as string) ? item.rarity : 'C') as Rarity,
    artist: String(item.artist || ''),
    source: String(item.source || 'Custom Import'),
    colors,
    ...(backFace && { backFace }),
    ...(artKey !== undefined && { artKey }),
    ...(customImageUrl !== undefined && { customImageUrl }),
    ...(setCode !== undefined && { setCode }),
    ...(setName !== undefined && { setName }),
    ...(collectorNumber !== undefined && { collectorNumber }),
    ...(scryfall && { scryfall }),
  };
}
