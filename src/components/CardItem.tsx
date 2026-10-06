import React from 'react';
import { Card } from '../types/card';
import { getRarityColor, getRarityLabel, getColorBadge } from '../utils/cardHelpers';
import { Sparkles, Shield } from 'lucide-react';

interface CardItemProps {
  card: Card;
  onClick?: () => void;
  showPackSlot?: string;
  isFlipped?: boolean; // false = card back, true = card face
  isFoil?: boolean;
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  onClick,
  showPackSlot,
  isFlipped = true,
  isFoil,
}) => {
  const isMythic = card.rarity === 'M';
  const isRare = card.rarity === 'R';
  const colors = card.colors || ['Colorless'];
  const isMulti = colors.includes('Multicolor');

  // Frame theme based on card colors
  let frameGradient = 'from-slate-900 via-slate-800 to-slate-950 border-slate-700/80';
  let innerArtTint = 'from-slate-800/60 to-slate-900/90';
  let titleBarBg = 'bg-slate-900/95 border-slate-700/60 text-slate-100';

  if (isMulti) {
    frameGradient = 'from-amber-950/70 via-stone-900 to-amber-950/90 border-amber-500/70 shadow-amber-950/30';
    titleBarBg = 'bg-amber-950/80 border-amber-500/50 text-amber-100';
  } else if (colors.includes('W')) {
    frameGradient = 'from-stone-800 via-stone-900 to-stone-950 border-amber-200/50';
    titleBarBg = 'bg-stone-900/90 border-amber-200/40 text-amber-50';
  } else if (colors.includes('U')) {
    frameGradient = 'from-sky-950/80 via-slate-900 to-blue-950/90 border-sky-500/60';
    titleBarBg = 'bg-sky-950/90 border-sky-500/50 text-sky-100';
  } else if (colors.includes('B')) {
    frameGradient = 'from-neutral-950 via-stone-950 to-black border-neutral-700';
    titleBarBg = 'bg-neutral-900/90 border-neutral-700 text-neutral-200';
  } else if (colors.includes('R')) {
    frameGradient = 'from-rose-950/70 via-stone-900 to-rose-950/90 border-rose-500/60';
    titleBarBg = 'bg-rose-950/90 border-rose-500/50 text-rose-100';
  } else if (colors.includes('G')) {
    frameGradient = 'from-emerald-950/70 via-stone-900 to-emerald-950/90 border-emerald-500/60';
    titleBarBg = 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100';
  }

  // Mythic & Rare outer enhancements
  if (isMythic) {
    frameGradient += ' ring-1 ring-orange-500/70 shadow-xl shadow-orange-950/40';
  } else if (isRare) {
    frameGradient += ' ring-1 ring-amber-400/50 shadow-lg shadow-amber-950/30';
  }

  // Face-down card back rendering
  if (!isFlipped) {
    return (
      <div
        onClick={onClick}
        className="group relative w-full h-[300px] rounded-2xl border-2 border-amber-900/60 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-3 flex flex-col items-center justify-between cursor-pointer select-none shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:border-amber-500/60 overflow-hidden"
      >
        <div className="absolute inset-1.5 border border-amber-500/20 rounded-xl pointer-events-none" />
        <div className="absolute inset-3 border border-slate-700/40 rounded-lg pointer-events-none" />

        <div className="text-[10px] tracking-widest text-amber-500/60 uppercase font-mono mt-1">
          CardForge TCG
        </div>

        <div className="relative w-20 h-20 rounded-full border-2 border-amber-500/30 bg-slate-950 flex flex-col items-center justify-center shadow-inner group-hover:border-amber-400/60 transition-colors">
          <div className="w-16 h-16 rounded-full border border-cyan-500/20 bg-slate-900/80 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-amber-400/70 group-hover:text-amber-300 group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div className="text-center pb-1">
          <span className="text-[11px] font-bold text-slate-400 group-hover:text-amber-300 transition-colors">
            Tap to Reveal
          </span>
          {showPackSlot && (
            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
              Slot: {showPackSlot}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Face-up Card Rendering
  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between w-full h-[300px] rounded-2xl border-2 bg-gradient-to-b ${frameGradient} p-2.5 transition-all duration-200 cursor-pointer select-none text-xs hover:-translate-y-1.5 hover:shadow-2xl overflow-hidden`}
    >
      {/* Holographic foil sheen overlay */}
      {(isFoil || isMythic) && (
        <div className="pointer-events-none absolute inset-0 foil-shimmer opacity-40 group-hover:opacity-80 transition-opacity z-20" />
      )}

      {/* Header Bar: Title and Mana Cost */}
      <div className="relative z-10">
        <div className={`flex items-center justify-between gap-1 px-2 py-1 rounded-lg border shadow-sm ${titleBarBg} mb-1.5`}>
          <span className="font-bold truncate text-[11.5px] leading-tight tracking-tight text-white group-hover:text-amber-300 transition-colors">
            {card.name}
          </span>
          {card.cost && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/60 text-amber-300 border border-amber-500/30 shadow-inner">
              {card.cost}
            </span>
          )}
        </div>

        {/* Art Window / Visual Centerpiece */}
        <div className="relative w-full h-[88px] rounded-lg bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-slate-800/80 flex flex-col items-center justify-center overflow-hidden mb-1.5 shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_70%)]" />

          {/* Color identity badge dots */}
          <div className="flex items-center gap-1 mb-1 z-10">
            {colors.filter(c => c !== 'Multicolor' && c !== 'Colorless').map(col => {
              const badge = getColorBadge(col);
              return (
                <span
                  key={col}
                  className={`w-3 h-3 rounded-full ${badge.bg} border ${badge.border} shadow-sm`}
                  title={badge.label}
                />
              );
            })}
          </div>

          <span className="text-[10px] font-medium text-slate-400/90 z-10 px-2 text-center line-clamp-1 italic">
            {card.type}
          </span>

          {isMythic && (
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-950/90 text-[8.5px] font-black text-orange-300 border border-orange-500/60 shadow-lg z-10">
              <Sparkles className="w-2.5 h-2.5 text-orange-400 animate-pulse" />
              MYTHIC
            </div>
          )}
        </div>

        {/* Type Line Bar with Rarity Crystal */}
        <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-black/40 border border-slate-800 text-[10px] text-slate-300 mb-1.5">
          <span className="truncate font-medium">{card.type}</span>
          <span
            className={`shrink-0 px-1.5 py-0.2 rounded font-bold text-[9px] border shadow-sm ${getRarityColor(card.rarity)}`}
            title={`Rarity: ${getRarityLabel(card.rarity)}`}
          >
            {card.rarity}
          </span>
        </div>

        {/* Oracle Rules Text Box */}
        <div className="px-2 py-1.5 rounded-lg bg-black/55 border border-slate-800/60 min-h-[58px] max-h-[64px] overflow-hidden flex flex-col justify-center">
          {card.text ? (
            <p className="text-[10px] leading-relaxed text-slate-200 line-clamp-3 font-normal">
              {card.text}
            </p>
          ) : card.flavorText ? (
            <p className="text-[9.5px] leading-relaxed text-slate-400 italic line-clamp-3">
              "{card.flavorText}"
            </p>
          ) : (
            <span className="text-[9.5px] text-slate-500 italic">— Basic Land —</span>
          )}
        </div>
      </div>

      {/* Card Footer: Artist attribution, Holo stamp, and P/T shield */}
      <div className="relative z-10 pt-1 mt-auto flex items-end justify-between border-t border-slate-800/60 text-[9px] text-slate-400">
        <div className="truncate max-w-[62%] leading-tight">
          <span className="text-slate-400 truncate block">
            {card.artist ? `Illus. ${card.artist}` : getRarityLabel(card.rarity)}
          </span>
          {showPackSlot && (
            <span className="text-[8px] font-mono text-cyan-400">
              {showPackSlot}
            </span>
          )}
        </div>

        {/* Authentic Holo Stamp for Rares & Mythics */}
        {(isRare || isMythic) && (
          <div
            className="w-4 h-2.5 rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 opacity-70 border border-white/40 shadow-sm"
            title="Authentic Collector Holofoil Stamp"
          />
        )}

        {/* Power / Toughness Shield */}
        {card.powerToughness && (
          <div className="px-2 py-0.5 rounded-md bg-black/80 font-mono font-black text-[10.5px] text-amber-300 border border-amber-500/40 shadow-md">
            {card.powerToughness}
          </div>
        )}
      </div>
    </div>
  );
};
