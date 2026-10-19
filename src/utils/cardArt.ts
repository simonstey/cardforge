import artData from '../data/cardArt.json';
import { Card } from '../types/card';

interface ArtEntry {
  art: string;
  full?: string;
  w: number;
  h: number;
  fullW?: number;
  fullH?: number;
  /** Second face of a double-faced card. */
  artBack?: string;
  fullBack?: string;
}

interface ArtManifest {
  version: number;
  cards: Record<string, ArtEntry>;
  landVariants?: Record<string, string[]>;
}

const manifest = artData as ArtManifest;

export interface CardArt {
  src: string;
  width?: number;
  height?: number;
  /** Full card scan, when one exists. */
  fullSrc?: string;
  fullWidth?: number;
  fullHeight?: number;
  /** Full scan of the other face of a double-faced card. */
  fullBackSrc?: string;
}

/** Asset paths are relative so the app works under a sub-path (GitHub Pages). */
const asset = (path: string) => `${import.meta.env?.BASE_URL ?? './'}${path}`;

/**
 * Resolve a card's artwork: user-supplied image first, then the extracted set art.
 * Basic lands have several printings; `variantSeed` picks one deterministically.
 */
export function getCardArt(card: Card, variantSeed = 0): CardArt | null {
  if (card.customImageUrl) return { src: card.customImageUrl };

  const entry = (card.artKey && manifest.cards[card.artKey]) || manifest.cards[`${card.source}::${card.name}`];

  if (card.rarity === 'L') {
    const variants = manifest.landVariants?.[card.name];
    if (variants && variants.length > 0) {
      const art = variants[Math.abs(variantSeed) % variants.length];
      // Every land printing has a full scan stored under the same file name.
      return {
        src: asset(art),
        width: entry?.w,
        height: entry?.h,
        fullSrc: asset(art.replace('cards/art/', 'cards/full/')),
        fullWidth: entry?.fullW,
        fullHeight: entry?.fullH,
      };
    }
  }

  if (!entry) return null;

  return {
    src: asset(entry.art),
    width: entry.w,
    height: entry.h,
    fullSrc: entry.full ? asset(entry.full) : undefined,
    fullWidth: entry.fullW,
    fullHeight: entry.fullH,
    fullBackSrc: entry.fullBack ? asset(entry.fullBack) : undefined,
  };
}
