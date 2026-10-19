import React from 'react';
import { RotateCw, RotateCcw } from 'lucide-react';
import { cx } from './ui/cx';

const PIP: Record<string, string> = {
  W: 'bg-mana-w text-amber-950',
  U: 'bg-mana-u text-white',
  B: 'bg-mana-b text-white',
  R: 'bg-mana-r text-white',
  G: 'bg-mana-g text-white',
};
const GENERIC = 'bg-slate-300 text-slate-900';

const COLOR_NAME: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };

/** Spoken name of a symbol such as "T", "2", "R" or "W/U". */
export function symbolName(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s === 'T') return 'tap';
  if (s === 'Q') return 'untap';
  if (s === 'X') return 'X mana';
  if (/^\d+$/.test(s)) return `${s} generic mana`;
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    if (b === 'P') return `${COLOR_NAME[a] ?? a} Phyrexian mana`;
    return `${COLOR_NAME[a] ?? a} or ${COLOR_NAME[b] ?? b} mana`;
  }
  return `${COLOR_NAME[s] ?? s} mana`;
}

interface ManaSymbolProps {
  symbol: string;
  size?: 'sm' | 'md';
  /** Decorative inside a labelled container; otherwise the symbol carries its own name. */
  decorative?: boolean;
}

/** One mana or tap symbol drawn as a pip. */
export const ManaSymbol: React.FC<ManaSymbolProps> = ({ symbol, size = 'sm', decorative = false }) => {
  const s = symbol.toUpperCase();
  const [first, second] = s.split('/');
  const isTap = s === 'T' || s === 'Q';
  const isHybrid = !!second && second !== 'P';
  const label = decorative ? undefined : symbolName(s);

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full font-bold leading-none align-[-0.15em] shadow-[0_1px_1px_rgb(0_0_0/0.5)]',
        size === 'sm' ? 'size-4 text-[0.6875rem]' : 'size-6 text-xs',
        isTap ? 'bg-slate-300 text-slate-900' : isHybrid ? '' : (PIP[first] ?? GENERIC)
      )}
      style={
        isHybrid
          ? { background: `linear-gradient(135deg, var(--color-mana-${first.toLowerCase()}) 50%, var(--color-mana-${second.toLowerCase()}) 50%)` }
          : undefined
      }
    >
      {s === 'T' ? (
        <RotateCw aria-hidden className={size === 'sm' ? 'size-2.5' : 'size-3.5'} strokeWidth={3} />
      ) : s === 'Q' ? (
        <RotateCcw aria-hidden className={size === 'sm' ? 'size-2.5' : 'size-3.5'} strokeWidth={3} />
      ) : isHybrid ? (
        ''
      ) : (
        first
      )}
    </span>
  );
};

/** Split "2WU", "X1R" or "{2}{W/U}" into symbols: runs of digits stay together, letters are one symbol each. */
export function parseCost(cost: string): string[] {
  const braced = cost.match(/\{[^}]+\}/g);
  if (braced) return braced.map(b => b.slice(1, -1));
  return cost.toUpperCase().match(/\d+|[A-Z]/g) ?? [];
}

interface ManaCostProps {
  cost?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Mana cost drawn as pips. The raw cost string is the accessible text. */
export const ManaCost: React.FC<ManaCostProps> = ({ cost, size = 'sm', className }) => {
  if (!cost) return null;
  const symbols = parseCost(cost);
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-0.5', className)}>
      <span className="sr-only">Mana cost {cost}</span>
      {symbols.map((s, i) => (
        <ManaSymbol key={i} symbol={s} size={size} decorative />
      ))}
    </span>
  );
};
