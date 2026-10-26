export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export type SymbolShape =
  | { kind: 'color'; color: ManaColor }
  | { kind: 'generic'; text: string }
  | { kind: 'hybrid'; a: string; b: string }
  | { kind: 'mono-hybrid'; generic: string; color: string }
  | { kind: 'phyrexian'; color: string }
  | { kind: 'hybrid-phyrexian'; a: string; b: string }
  | { kind: 'tap' }
  | { kind: 'untap' }
  | { kind: 'colorless' }
  | { kind: 'snow' }
  | { kind: 'other'; text: string };

const COLOR_NAME: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };
const GENERIC_TEXT = /^(\d+|[XYZ]|½|∞)$/;

/** Split "2WU", "X1R" or "{2}{W/U}" into symbols: runs of digits stay together, letters are one symbol each. */
export function parseCost(cost: string): string[] {
  const braced = cost.match(/\{[^}]+\}/g);
  if (braced) return braced.map(b => b.slice(1, -1));
  return cost.toUpperCase().match(/\d+|[A-Z]/g) ?? [];
}

/** Classify a symbol such as "T", "2", "R", "W/U", "2/W", "G/P", "W/U/P", "S" or "CHAOS". */
export function symbolShape(symbol: string): SymbolShape {
  const s = symbol.toUpperCase();
  if (s === 'T') return { kind: 'tap' };
  if (s === 'Q') return { kind: 'untap' };
  if (s === 'C') return { kind: 'colorless' };
  if (s === 'S') return { kind: 'snow' };
  if (s === 'W' || s === 'U' || s === 'B' || s === 'R' || s === 'G') return { kind: 'color', color: s };
  if (GENERIC_TEXT.test(s)) return { kind: 'generic', text: s };
  const parts = s.split('/');
  if (parts.length >= 2 && parts.length <= 3 && parts.every(p => p)) {
    if (parts[parts.length - 1] === 'P') {
      if (parts.length === 2) return { kind: 'phyrexian', color: parts[0] };
      return { kind: 'hybrid-phyrexian', a: parts[0], b: parts[1] };
    }
    if (parts.length === 2) {
      if (/^\d+$/.test(parts[0])) return { kind: 'mono-hybrid', generic: parts[0], color: parts[1] };
      return { kind: 'hybrid', a: parts[0], b: parts[1] };
    }
  }
  return { kind: 'other', text: s };
}

/** Spoken name of a symbol such as "T", "2", "R", "W/U", "2/W" or "CHAOS". */
export function symbolName(symbol: string): string {
  const shape = symbolShape(symbol);
  const name = (c: string) => COLOR_NAME[c] ?? c;
  switch (shape.kind) {
    case 'tap':
      return 'tap';
    case 'untap':
      return 'untap';
    case 'colorless':
      return 'colorless mana';
    case 'snow':
      return 'snow mana';
    case 'color':
      return `${name(shape.color)} mana`;
    case 'generic':
      if (shape.text === 'X' || shape.text === 'Y' || shape.text === 'Z') return `${shape.text} mana`;
      if (shape.text === '½') return 'half generic mana';
      if (shape.text === '∞') return 'infinite generic mana';
      return `${shape.text} generic mana`;
    case 'hybrid':
      return `${name(shape.a)} or ${name(shape.b)} mana`;
    case 'mono-hybrid':
      return `${shape.generic} generic or ${name(shape.color)} mana`;
    case 'phyrexian':
      return `${name(shape.color)} Phyrexian mana`;
    case 'hybrid-phyrexian':
      return `${name(shape.a)} or ${name(shape.b)} Phyrexian mana`;
    case 'other':
      return `${shape.text} symbol`;
  }
}
