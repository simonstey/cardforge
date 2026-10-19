import React from 'react';
import { ManaSymbol } from './ManaCost';

interface RulesTextProps {
  text: string;
  size?: 'sm' | 'md';
  /** Classes for each paragraph. */
  paragraphClassName?: string;
}

const SYMBOL = /\{([^}]+)\}/g;

/** Render one line, turning {T}, {2}, {R}, {W/U} … into inline symbols. */
function renderLine(line: string, size: 'sm' | 'md'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(SYMBOL)) {
    if (match.index > last) out.push(line.slice(last, match.index));
    out.push(<ManaSymbol key={match.index} symbol={match[1]} size={size} />);
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Card rules text: one paragraph per line, with mana and tap symbols drawn inline. */
export const RulesText: React.FC<RulesTextProps> = ({ text, size = 'sm', paragraphClassName }) => (
  <>
    {text
      .split('\n')
      .filter(line => line.trim())
      .map((line, i) => (
        <span key={i} className={paragraphClassName ?? 'block'}>
          {renderLine(line, size)}
        </span>
      ))}
  </>
);
