import { Card, CardColor, Rarity } from '../types/card';

export function determineColors(cost?: string, type?: string): CardColor[] {
  if (!cost) {
    if (type?.toLowerCase().includes('land')) return ['Colorless'];
    return ['Colorless'];
  }
  const cleanCost = cost.toUpperCase();
  const colorsFound = new Set<CardColor>();
  if (cleanCost.includes('W')) colorsFound.add('W');
  if (cleanCost.includes('U')) colorsFound.add('U');
  if (cleanCost.includes('B')) colorsFound.add('B');
  if (cleanCost.includes('R')) colorsFound.add('R');
  if (cleanCost.includes('G')) colorsFound.add('G');

  if (colorsFound.size === 0) return ['Colorless'];
  if (colorsFound.size > 1) return ['Multicolor', ...Array.from(colorsFound)];
  return Array.from(colorsFound);
}

export function getRarityLabel(rarity: Rarity): string {
  return RARITY[rarity]?.label ?? 'Common';
}

interface RarityStyle {
  label: string;
  /** Text color class for the rarity's identity color. */
  text: string;
  /** Small bordered badge (text + tinted fill). */
  badge: string;
}

/** Single source of truth for rarity presentation. */
export const RARITY: Record<Rarity, RarityStyle> = {
  C: { label: 'Common', text: 'text-rarity-c', badge: 'text-rarity-c border-rarity-c/40 bg-rarity-c/10' },
  U: { label: 'Uncommon', text: 'text-rarity-u', badge: 'text-rarity-u border-rarity-u/50 bg-rarity-u/10' },
  R: { label: 'Rare', text: 'text-rarity-r', badge: 'text-rarity-r border-rarity-r/50 bg-rarity-r/10' },
  M: { label: 'Mythic Rare', text: 'text-rarity-m', badge: 'text-rarity-m border-rarity-m/60 bg-rarity-m/15' },
  L: { label: 'Basic Land', text: 'text-rarity-l', badge: 'text-rarity-l border-rarity-l/50 bg-rarity-l/10' },
  T: { label: 'Token', text: 'text-rarity-t', badge: 'text-rarity-t border-rarity-t/50 bg-rarity-t/10' },
};

export const RARITY_ORDER: Rarity[] = ['C', 'U', 'R', 'M', 'L', 'T'];

interface ManaStyle {
  label: string;
  /** Solid swatch used for dots and distribution bars. */
  swatch: string;
  /** Card face frame: gradient + border. */
  frame: string;
  /** Card face title and type bars. */
  bar: string;
}

/** Single source of truth for color identity (mana) presentation. */
export const MANA: Record<CardColor, ManaStyle> = {
  W: {
    label: 'White',
    swatch: 'bg-mana-w',
    frame: 'from-stone-700 via-stone-900 to-stone-950 border-mana-w/50',
    bar: 'bg-stone-900/90 border-mana-w/40 text-amber-50',
  },
  U: {
    label: 'Blue',
    swatch: 'bg-mana-u',
    frame: 'from-sky-950 via-slate-900 to-blue-950 border-mana-u/60',
    bar: 'bg-sky-950/90 border-mana-u/50 text-sky-50',
  },
  B: {
    label: 'Black',
    swatch: 'bg-mana-b',
    frame: 'from-neutral-900 via-stone-950 to-black border-neutral-600',
    bar: 'bg-neutral-900/90 border-neutral-600 text-neutral-100',
  },
  R: {
    label: 'Red',
    swatch: 'bg-mana-r',
    frame: 'from-rose-950 via-stone-900 to-rose-950 border-mana-r/60',
    bar: 'bg-rose-950/90 border-mana-r/50 text-rose-50',
  },
  G: {
    label: 'Green',
    swatch: 'bg-mana-g',
    frame: 'from-emerald-950 via-stone-900 to-emerald-950 border-mana-g/60',
    bar: 'bg-emerald-950/90 border-mana-g/50 text-emerald-50',
  },
  Multicolor: {
    label: 'Multicolor',
    swatch: 'bg-mana-multi',
    frame: 'from-amber-950 via-stone-900 to-amber-950 border-mana-multi/70',
    bar: 'bg-amber-950/85 border-mana-multi/50 text-amber-50',
  },
  Colorless: {
    label: 'Colorless',
    swatch: 'bg-mana-c',
    frame: 'from-slate-800 via-slate-900 to-slate-950 border-slate-600',
    bar: 'bg-slate-900/90 border-slate-600 text-slate-100',
  },
};

/** Display names for set codes (see getCardSetCode in boosterCollation). */
export const SET_NAMES: Record<string, string> = {
  Main: 'Base set',
  TFA: 'The Force Awakens',
  RO: 'Rogue One',
  TLJ: 'The Last Jedi',
  SOLO: 'Solo',
  ROS: 'Rise of Skywalker',
  RBL: 'Rebels',
};

export const MANA_ORDER: CardColor[] = ['W', 'U', 'B', 'R', 'G', 'Multicolor', 'Colorless'];

const BASIC_LAND_IDENTITY: Record<string, CardColor> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
};

/** The identity that decides a card's frame: multicolor, its one color, a basic land's color, or colorless. */
export function frameIdentity(card: Card): CardColor {
  const colors = card.colors || ['Colorless'];
  if (colors.includes('Multicolor')) return 'Multicolor';
  const mono = colors.find(c => c !== 'Colorless');
  if (mono) return mono;
  if (card.rarity === 'L') return BASIC_LAND_IDENTITY[card.name.toLowerCase()] ?? 'Colorless';
  return 'Colorless';
}

/** The individual colors of a card (no Multicolor/Colorless markers). */
export function colorPips(card: Card): CardColor[] {
  return (card.colors || []).filter(c => c !== 'Multicolor' && c !== 'Colorless');
}
