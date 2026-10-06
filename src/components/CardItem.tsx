import React from 'react';
import { Card } from '../types/card';
import { getRarityColor, getRarityLabel, getColorBadge } from '../utils/cardHelpers';
import { Shield, Sparkles } from 'lucide-react';

interface CardItemProps {
  card: Card;
  onClick?: () => void;
  showPackSlot?: string;
  isFlipped?: boolean;
  isFoil?: boolean;
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  onClick,
  showPackSlot,
  isFoil,
}) => {
  const isMythic = card.rarity === 'M';
  const isRare = card.rarity === 'R';

  // Determine frame styling based on color
  const colors = card.colors || ['Colorless'];
  const isMulti = colors.includes('Multicolor');

  let borderGradient = 'border-slate-700 bg-slate-900';
  if (isMythic) {
    borderGradient = 'border-orange-500/80 bg-gradient-to-b from-orange-950/40 to-slate-900 ring-1 ring-orange-500/50 shadow-orange-950/50';
  } else if (isRare) {
    borderGradient = 'border-amber-400/80 bg-gradient-to-b from-amber-950/40 to-slate-900 ring-1 ring-amber-400/40 shadow-amber-950/50';
  } else if (card.rarity === 'U') {
    borderGradient = 'border-sky-400/70 bg-gradient-to-b from-sky-950/30 to-slate-900 ring-1 ring-sky-400/30';
  }

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between w-full h-[280px] rounded-xl border p-2.5 transition-all duration-200 cursor-pointer select-none text-xs hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30 ${borderGradient} overflow-hidden`}
    >
      {/* Foil Shimmer effect */}
      {(isFoil || isMythic) && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}

      {/* Top Header: Name and Mana Cost */}
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-bold text-slate-100 truncate text-[11px] leading-tight group-hover:text-amber-300 transition-colors">
            {card.name}
          </span>
          {card.cost && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-amber-200 border border-slate-700">
              {card.cost}
            </span>
          )}
        </div>

        {/* Subheader: Type Line and Rarity Indicator */}
        <div className="flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-slate-800 text-[10px] text-slate-400">
          <span className="truncate">{card.type}</span>
          <span className={`px-1 py-0.2 rounded font-semibold text-[9px] border ${getRarityColor(card.rarity)}`}>
            {card.rarity}
          </span>
        </div>

        {/* Card Artwork Simulation Box */}
        <div className="relative w-full h-20 rounded bg-slate-800/80 border border-slate-700/60 flex items-center justify-center overflow-hidden mb-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.1),transparent_70%)]" />
          <div className="text-center px-2 z-10">
            <span className="text-[10px] font-medium text-slate-400 line-clamp-1">{card.name}</span>
            <div className="flex justify-center gap-1 mt-1">
              {colors.filter(c => c !== 'Multicolor' && c !== 'Colorless').map(col => {
                const badge = getColorBadge(col);
                return (
                  <span key={col} className={`inline-block w-2.5 h-2.5 rounded-full ${badge.bg} border ${badge.border}`} title={badge.label} />
                );
              })}
            </div>
          </div>
          {isMythic && (
            <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-900/80 text-[8px] font-bold text-orange-200 border border-orange-500/50">
              <Sparkles className="w-2.5 h-2.5 text-orange-400 animate-pulse" />
              MYTHIC
            </div>
          )}
        </div>

        {/* Rules text */}
        {card.text && (
          <p className="text-[10.5px] leading-snug text-slate-300 line-clamp-3 font-normal">
            {card.text}
          </p>
        )}
      </div>

      {/* Footer: Flavor text & Power/Toughness */}
      <div className="pt-1 mt-auto border-t border-slate-800/60 flex items-end justify-between text-[9px] text-slate-400">
        <div className="truncate max-w-[70%]">
          {card.artist ? (
            <span className="text-slate-400 truncate">Illus. {card.artist}</span>
          ) : (
            <span className="text-slate-400">{getRarityLabel(card.rarity)}</span>
          )}
        </div>

        {card.powerToughness && (
          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold font-mono text-[10px] text-amber-200 border border-slate-700">
            {card.powerToughness}
          </span>
        )}

        {showPackSlot && (
          <span className="text-[8px] font-mono text-cyan-400 bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-800/50">
            {showPackSlot}
          </span>
        )}
      </div>
    </div>
  );
};
