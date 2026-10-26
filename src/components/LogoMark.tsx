import React from 'react';

/** Spark dashes either side of the card, innermost first; small sizes drop the outermost pair. */
const SPARKS = [
  'M16.5 30.5 12.5 26.5M47.5 30.5 51.5 26.5',
  'M15.5 35 10 33.6M48.5 35 54 33.6',
  'M19.2 26.2 17.4 21.6M44.8 26.2 46.6 21.6',
];

interface LogoMarkProps {
  className?: string;
  /** Spark pairs to draw: 3 for large sizes, 2 keeps the mark clean at header and favicon size. */
  sparks?: 2 | 3;
}

/**
 * The CardForge mark: a card struck on an anvil, with foil sparks. Drawn on a 64-unit grid, colours from the
 * accent and foil tokens; the tile behind it is up to the caller. public/favicon.svg is the same drawing.
 */
export const LogoMark: React.FC<LogoMarkProps> = ({ className, sparks = 3 }) => (
  <svg viewBox="0 0 64 64" aria-hidden className={className}>
    <path
      d={SPARKS.slice(0, sparks).join('')}
      className="stroke-foil"
      fill="none"
      strokeWidth={3.2}
      strokeLinecap="round"
    />
    <rect x="22" y="8" width="20" height="27" rx="3.5" className="fill-void stroke-accent" strokeWidth={4} />
    <path
      className="fill-accent"
      d="M7 37H53V42Q43 43 40.5 48L44 52.5V56H20V52.5L23.5 48Q21.5 43.5 14.5 42.5Q9.5 41.5 7 37Z"
    />
  </svg>
);
