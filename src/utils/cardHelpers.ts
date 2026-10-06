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
  switch (rarity) {
    case 'C': return 'Common';
    case 'U': return 'Uncommon';
    case 'R': return 'Rare';
    case 'M': return 'Mythic Rare';
    case 'L': return 'Basic Land';
    case 'T': return 'Token';
    default: return 'Common';
  }
}

export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'C': return 'text-slate-300 border-slate-400 bg-slate-800';
    case 'U': return 'text-sky-300 border-sky-400 bg-sky-950/80';
    case 'R': return 'text-amber-300 border-amber-400 bg-amber-950/80';
    case 'M': return 'text-orange-400 border-orange-500 bg-orange-950/80';
    case 'L': return 'text-emerald-300 border-emerald-500 bg-emerald-950/80';
    case 'T': return 'text-purple-300 border-purple-400 bg-purple-950/80';
    default: return 'text-slate-300 border-slate-400 bg-slate-800';
  }
}

export function getColorBadge(color: string): { bg: string; text: string; label: string; border: string } {
  switch (color) {
    case 'W': return { bg: 'bg-amber-100/90 text-amber-900 border-amber-300', text: 'text-amber-900', label: 'White', border: 'border-amber-200' };
    case 'U': return { bg: 'bg-blue-600/90 text-white border-blue-400', text: 'text-blue-400', label: 'Blue', border: 'border-blue-500' };
    case 'B': return { bg: 'bg-neutral-800 text-neutral-200 border-neutral-600', text: 'text-neutral-400', label: 'Black', border: 'border-neutral-700' };
    case 'R': return { bg: 'bg-rose-700/90 text-white border-rose-400', text: 'text-rose-400', label: 'Red', border: 'border-rose-500' };
    case 'G': return { bg: 'bg-emerald-700/90 text-white border-emerald-400', text: 'text-emerald-400', label: 'Green', border: 'border-emerald-500' };
    case 'Multicolor': return { bg: 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 text-white border-amber-300', text: 'text-amber-400', label: 'Multi', border: 'border-amber-400' };
    default: return { bg: 'bg-zinc-700 text-zinc-200 border-zinc-500', text: 'text-zinc-400', label: 'Colorless', border: 'border-zinc-600' };
  }
}
