import React from 'react';
import { RotateCw, RotateCcw, Snowflake } from 'lucide-react';
import { parseCost, symbolName, symbolShape } from '../utils/manaSymbols';
import { cx } from './ui/cx';

const PIP: Record<string, string> = {
  W: 'bg-mana-w text-amber-950',
  U: 'bg-mana-u text-white',
  B: 'bg-mana-b text-white',
  R: 'bg-mana-r text-white',
  G: 'bg-mana-g text-white',
};
const GENERIC = 'bg-slate-300 text-slate-900';

interface ManaSymbolProps {
  symbol: string;
  size?: 'sm' | 'md';
  /** Decorative inside a labelled container; otherwise the symbol carries its own name. */
  decorative?: boolean;
}

const MANA_VAR: Record<string, string> = {
  W: 'var(--color-mana-w)',
  U: 'var(--color-mana-u)',
  B: 'var(--color-mana-b)',
  R: 'var(--color-mana-r)',
  G: 'var(--color-mana-g)',
};
const GENERIC_VAR = 'var(--color-slate-300)';

/** Fill for one half of a split pip: a mana colour, or the generic grey. */
const half = (c: string) => MANA_VAR[c] ?? GENERIC_VAR;
const split = (a: string, b: string) => `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;

/** One mana, tap or other game symbol drawn as a pip. */
export const ManaSymbol: React.FC<ManaSymbolProps> = ({ symbol, size = 'sm', decorative = false }) => {
  const shape = symbolShape(symbol);
  const label = decorative ? undefined : symbolName(symbol);
  const icon = size === 'sm' ? 'size-2.5' : 'size-3.5';

  let tone = GENERIC;
  let background: string | undefined;
  let content: React.ReactNode = null;
  switch (shape.kind) {
    case 'color':
      tone = PIP[shape.color];
      content = shape.color;
      break;
    case 'generic':
      content = shape.text;
      break;
    case 'hybrid':
      tone = 'text-white';
      background = split(half(shape.a), half(shape.b));
      break;
    case 'mono-hybrid':
      tone = 'text-slate-900';
      background = split(GENERIC_VAR, half(shape.color));
      content = shape.generic;
      break;
    case 'phyrexian':
      tone = PIP[shape.color] ?? GENERIC;
      content = 'φ';
      break;
    case 'hybrid-phyrexian':
      tone = 'text-white';
      background = split(half(shape.a), half(shape.b));
      content = 'φ';
      break;
    case 'tap':
      content = <RotateCw aria-hidden className={icon} strokeWidth={3} />;
      break;
    case 'untap':
      content = <RotateCcw aria-hidden className={icon} strokeWidth={3} />;
      break;
    case 'colorless':
      tone = `${GENERIC} ring-1 ring-inset ring-slate-600`;
      content = 'C';
      break;
    case 'snow':
      content = <Snowflake aria-hidden className={icon} strokeWidth={3} />;
      break;
    case 'other':
      content = shape.text.charAt(0);
      break;
  }

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full font-bold leading-none align-[-0.15em] shadow-[0_1px_1px_rgb(0_0_0/0.5)]',
        size === 'sm' ? 'size-4 text-[0.6875rem]' : 'size-6 text-xs',
        tone
      )}
      style={background ? { background } : undefined}
    >
      {content}
    </span>
  );
};

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
