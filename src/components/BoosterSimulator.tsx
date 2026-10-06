import React, { useState } from 'react';
import { BoosterPack, Card } from '../types/card';
import { CardItem } from './CardItem';
import { CardModal } from './CardModal';
import { computeCollationStats } from '../utils/boosterCollation';
import { getColorBadge } from '../utils/cardHelpers';
import { Package, Sparkles, Eye, ChevronRight, ChevronLeft, Layers, BarChart3, Shuffle, CheckCircle, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BoosterSimulatorProps {
  packs: BoosterPack[];
  onOpenPrintModal: () => void;
  onInspectCard: (card: Card) => void;
}

export const BoosterSimulator: React.FC<BoosterSimulatorProps> = ({
  packs,
  onOpenPrintModal,
  onInspectCard,
}) => {
  const [selectedPackIndex, setSelectedPackIndex] = useState<number>(0);
  const [isOpeningMode, setIsOpeningMode] = useState<boolean>(false);
  const [revealedCardCount, setRevealedCardCount] = useState<number>(0);

  if (packs.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Booster Packs Generated Yet</h3>
        <p className="text-xs text-slate-400 mt-1">
          Adjust the slot settings above and click "Generate Packs" to simulate packs and print sheets.
        </p>
      </div>
    );
  }

  const currentPack = packs[selectedPackIndex] || packs[0];
  const stats = computeCollationStats(packs);

  // Trigger confetti for mythic pulls
  const handleRevealNext = () => {
    const nextCount = revealedCardCount + 1;
    setRevealedCardCount(nextCount);

    if (nextCount <= currentPack.cards.length) {
      const revealedCard = currentPack.cards[nextCount - 1];
      if (revealedCard.rarity === 'M') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#fbbf24', '#ef4444', '#ec4899'],
        });
      }
    }
  };

  const handleRevealAll = () => {
    setRevealedCardCount(currentPack.cards.length);
    if (currentPack.hasMythic) {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fbbf24', '#ef4444'],
      });
    }
  };

  const startOpenPack = (index: number) => {
    setSelectedPackIndex(index);
    setIsOpeningMode(true);
    setRevealedCardCount(0);
  };

  const totalCardsInPacks = packs.reduce((acc, p) => acc + p.cards.length, 0);

  return (
    <div className="space-y-6">
      {/* Collation Health & Color Distribution Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Collation & Color Balance Health
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  stats.colorBalanceScore >= 85
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border-amber-700'
                }`}>
                  {stats.colorBalanceScore}% Balanced
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Evaluating across {packs.length} generated packs ({totalCardsInPacks} total cards)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mythic hit rate */}
            <div className="text-right">
              <span className="text-[11px] text-slate-400">Mythics Found</span>
              <div className="text-sm font-bold text-orange-400 flex items-center justify-end gap-1 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                {stats.mythicPacksCount} of {stats.totalPacks} packs ({stats.mythicRatePercent}%)
              </div>
            </div>

            <button
              onClick={onOpenPrintModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
            >
              Export PDF Print Sheets
            </button>
          </div>
        </div>

        {/* Color Distribution Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Color Breakdown across All Packs:</span>
            <span className="text-[11px] text-slate-500">Target: Even distribution across 5 colors</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {[
              { code: 'W', name: 'White', barColor: 'bg-amber-100 text-amber-900', border: 'border-amber-300' },
              { code: 'U', name: 'Blue', barColor: 'bg-blue-600 text-white', border: 'border-blue-400' },
              { code: 'B', name: 'Black', barColor: 'bg-neutral-800 text-neutral-200', border: 'border-neutral-600' },
              { code: 'R', name: 'Red', barColor: 'bg-rose-700 text-white', border: 'border-rose-400' },
              { code: 'G', name: 'Green', barColor: 'bg-emerald-700 text-white', border: 'border-emerald-400' },
              { code: 'Multicolor', name: 'Multi', barColor: 'bg-amber-500 text-white', border: 'border-amber-400' },
              { code: 'Colorless', name: 'Colorless', barColor: 'bg-zinc-700 text-zinc-200', border: 'border-zinc-600' },
            ].map(col => {
              const count = stats.colorDistribution[col.code] || 0;
              const avg = stats.averageColorPerPack[col.code] || 0;
              const pct = totalCardsInPacks > 0 ? ((count / totalCardsInPacks) * 100).toFixed(1) : 0;

              return (
                <div key={col.code} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.barColor} border ${col.border}`} />
                      {col.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{count}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
                    <div
                      className={`h-full ${col.barColor}`}
                      style={{ width: `${Math.min(100, (count / (totalCardsInPacks / 6)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{pct}%</span>
                    <span>~{avg}/pack</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pack Navigation & Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          <span className="text-xs text-slate-400 shrink-0 font-medium">Select Pack:</span>
          {packs.map((pack, idx) => {
            const isSelected = idx === selectedPackIndex;
            return (
              <button
                key={pack.id}
                onClick={() => {
                  setSelectedPackIndex(idx);
                  setRevealedCardCount(isOpeningMode ? 0 : pack.cards.length);
                }}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Pack #{pack.packNumber}
                {pack.hasMythic && (
                  <Sparkles className="w-3 h-3 text-orange-400 inline ml-1 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const prev = Math.max(0, selectedPackIndex - 1);
              setSelectedPackIndex(prev);
              setRevealedCardCount(isOpeningMode ? 0 : packs[prev].cards.length);
            }}
            disabled={selectedPackIndex === 0}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400">
            {selectedPackIndex + 1} / {packs.length}
          </span>
          <button
            onClick={() => {
              const next = Math.min(packs.length - 1, selectedPackIndex + 1);
              setSelectedPackIndex(next);
              setRevealedCardCount(isOpeningMode ? 0 : packs[next].cards.length);
            }}
            disabled={selectedPackIndex === packs.length - 1}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => startOpenPack(selectedPackIndex)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900/60 transition-colors ml-2"
          >
            <Flame className="w-3.5 h-3.5 text-indigo-400" />
            Crack This Pack
          </button>
        </div>
      </div>

      {/* Pack Detail Header */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            Pack #{currentPack.packNumber} Contents ({currentPack.cards.length} Cards)
            {currentPack.hasMythic ? (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-600/50">
                <Sparkles className="w-3 h-3 text-orange-400" />
                Mythic Rare Included!
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-700/50">
                Standard Rare
              </span>
            )}
          </div>
        </div>

        {/* Color tally of this specific pack */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 mr-1">This pack's colors:</span>
          {(['W', 'U', 'B', 'R', 'G'] as const).map(col => {
            const count = currentPack.colorCounts[col] || 0;
            const badge = getColorBadge(col);
            return (
              <span
                key={col}
                className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${badge.bg} border ${badge.border}`}
                title={`${col}: ${count} cards`}
              >
                {col}:{count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Interactive Pack Opening Simulator or Grid View */}
      {isOpeningMode ? (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-5">
          <div className="flex items-center justify-between max-w-xl mx-auto pb-3 border-b border-slate-800">
            <span className="text-xs text-slate-400">
              Revealed: {revealedCardCount} of {currentPack.cards.length} cards
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleRevealNext}
                disabled={revealedCardCount >= currentPack.cards.length}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-all cursor-pointer"
              >
                Reveal Next Card
              </button>
              <button
                onClick={handleRevealAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Reveal All
              </button>
              <button
                onClick={() => setIsOpeningMode(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {currentPack.cards.map((card, idx) => {
              const isRevealed = idx < revealedCardCount;
              if (!isRevealed) {
                return (
                  <div
                    key={`${card.id}-${idx}`}
                    onClick={handleRevealNext}
                    className="w-full h-[280px] rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500/50 cursor-pointer transition-all hover:scale-[1.02] shadow-lg shadow-black/50 select-none group"
                  >
                    <div className="w-16 h-24 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3 group-hover:border-cyan-400 transition-colors">
                      <Sparkles className="w-6 h-6 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-cyan-300">
                      Card #{idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-600">Click to flip</span>
                  </div>
                );
              }

              return (
                <div key={`${card.id}-${idx}`} className="animate-in zoom-in-95 duration-200">
                  <CardItem card={card} onClick={() => onInspectCard(card)} />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Regular Pack Grid Display */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {currentPack.cards.map((card, idx) => {
            let slotLabel = 'C';
            if (card.rarity === 'M') slotLabel = 'MYTHIC';
            else if (card.rarity === 'R') slotLabel = 'RARE';
            else if (card.rarity === 'U') slotLabel = 'UNCOMMON';
            else if (card.rarity === 'L') slotLabel = 'LAND';
            else if (card.rarity === 'T') slotLabel = 'TOKEN';

            return (
              <CardItem
                key={`${card.id}-${idx}`}
                card={card}
                showPackSlot={slotLabel}
                onClick={() => onInspectCard(card)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
