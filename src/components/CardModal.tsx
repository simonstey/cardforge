import React from 'react';
import { Card } from '../types/card';
import { getRarityColor, getRarityLabel, getColorBadge } from '../utils/cardHelpers';
import { X, Sparkles, User, BookOpen, Layers } from 'lucide-react';

interface CardModalProps {
  card: Card | null;
  onClose: () => void;
  onEdit?: (card: Card) => void;
  onDelete?: (id: string) => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, onClose, onEdit, onDelete }) => {
  if (!card) return null;

  const isMythic = card.rarity === 'M';
  const isRare = card.rarity === 'R';
  const colors = card.colors || ['Colorless'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden">
        {/* Glow ambient background */}
        {isMythic && (
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
        )}
        {isRare && (
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Card Title and Cost */}
        <div className="flex items-start justify-between gap-3 pr-8 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {card.name}
              {isMythic && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-500/40">
                  <Sparkles className="w-3 h-3 text-orange-400" />
                  Mythic Rare
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{card.type}</p>
          </div>
          {card.cost && (
            <span className="px-3 py-1 text-sm font-mono font-bold rounded-lg bg-slate-800 text-amber-300 border border-slate-700 shadow-inner">
              {card.cost}
            </span>
          )}
        </div>

        {/* Meta details */}
        <div className="grid grid-cols-2 gap-2 my-4 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Rarity:
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold border ${getRarityColor(card.rarity)}`}>
              {getRarityLabel(card.rarity)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
            <span className="text-slate-400">Colors:</span>
            <div className="flex gap-1">
              {colors.map(col => {
                const badge = getColorBadge(col);
                return (
                  <span
                    key={col}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${badge.bg} border ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Oracle/Rules Text */}
        {card.text && (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-200 leading-relaxed mb-4 whitespace-pre-line">
            {card.text}
          </div>
        )}

        {/* Flavor text */}
        {card.flavorText && (
          <div className="p-3 rounded-lg bg-slate-800/30 border-l-2 border-amber-500/40 text-xs text-slate-400 italic mb-4">
            "{card.flavorText}"
          </div>
        )}

        {/* Power / Toughness and Artist */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Artist: {card.artist || 'Unknown'}</span>
          </div>
          {card.powerToughness && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Power / Toughness:</span>
              <span className="px-2.5 py-1 text-sm font-bold font-mono rounded bg-slate-800 text-amber-300 border border-slate-700">
                {card.powerToughness}
              </span>
            </div>
          )}
        </div>

        {/* Actions if provided */}
        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(card.id);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-950/50 hover:border-rose-700 border border-transparent transition-colors"
              >
                Delete Card
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(card);
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                Edit Card
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
