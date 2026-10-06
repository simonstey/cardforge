import React, { useState, useEffect } from 'react';
import { BoosterPack, Card } from '../types/card';
import { CardItem } from './CardItem';
import { computeCollationStats } from '../utils/boosterCollation';
import { getColorBadge } from '../utils/cardHelpers';
import {
  playCardFlipSound,
  playPackRipSound,
  playMythicChimeSound,
  playClickSound,
} from '../utils/audioFeedback';
import {
  Package,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Flame,
  Volume2,
  VolumeX,
  Printer,
  Maximize2,
  RotateCw,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BoosterSimulatorProps {
  packs: BoosterPack[];
  onOpenPrintModal: () => void;
  onInspectCard: (card: Card) => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
}

export const BoosterSimulator: React.FC<BoosterSimulatorProps> = ({
  packs,
  onOpenPrintModal,
  onInspectCard,
  isSoundEnabled,
  onToggleSound,
}) => {
  const [selectedPackIndex, setSelectedPackIndex] = useState<number>(0);
  const [isOpeningCeremony, setIsOpeningCeremony] = useState<boolean>(false);
  const [isPackTorn, setIsPackTorn] = useState<boolean>(false);
  const [revealedCardCount, setRevealedCardCount] = useState<number>(0);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !isOpeningCeremony) {
        setSelectedPackIndex(prev => Math.min(packs.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' && !isOpeningCeremony) {
        setSelectedPackIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (isOpeningCeremony) {
          if (!isPackTorn) {
            handleTearPack();
          } else {
            handleRevealNext();
          }
        }
      } else if (e.key === 'Escape') {
        if (isOpeningCeremony) {
          setIsOpeningCeremony(false);
          setIsPackTorn(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpeningCeremony, isPackTorn, packs.length, revealedCardCount, selectedPackIndex]);

  if (packs.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
          <Package className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 font-heading">No Booster Packs Generated Yet</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Set your preferred slot distribution above and click "Generate Packs" to initiate collation and preview packs.
        </p>
      </div>
    );
  }

  const currentPack = packs[selectedPackIndex] || packs[0];
  const stats = computeCollationStats(packs);

  // Sort cards inside the pack for authentic MTG opening order:
  // Tokens & Lands first, then Commons, then Uncommons, and the Rare/Mythic at the very end!
  const sortedCardsForOpening = [...currentPack.cards].sort((a, b) => {
    const order: Record<string, number> = { T: 1, L: 2, C: 3, U: 4, R: 5, M: 6 };
    return (order[a.rarity] || 3) - (order[b.rarity] || 3);
  });

  const handleStartCeremony = (idx: number) => {
    playClickSound();
    setSelectedPackIndex(idx);
    setIsOpeningCeremony(true);
    setIsPackTorn(false);
    setRevealedCardCount(0);
  };

  const handleTearPack = () => {
    playPackRipSound();
    setIsPackTorn(true);
    setRevealedCardCount(0);

    // Subtle burst
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#38bdf8', '#fbbf24', '#ffffff'],
    });
  };

  const handleRevealNext = () => {
    if (revealedCardCount < sortedCardsForOpening.length) {
      const nextCount = revealedCardCount + 1;
      setRevealedCardCount(nextCount);

      const cardRevealed = sortedCardsForOpening[nextCount - 1];
      if (cardRevealed.rarity === 'M') {
        playMythicChimeSound();
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f97316', '#fbbf24', '#ef4444', '#ec4899', '#ffffff'],
        });
      } else {
        playCardFlipSound();
      }
    }
  };

  const handleRevealAll = () => {
    playCardFlipSound();
    setRevealedCardCount(sortedCardsForOpening.length);
    if (currentPack.hasMythic) {
      playMythicChimeSound();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fbbf24', '#ffffff'],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Collation Health & Color Distribution Bar */}
      <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Subtle decorative radial glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white font-heading">
                  Collation & Color Distribution
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  stats.colorBalanceScore >= 85
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
                    : 'bg-amber-950 text-amber-300 border-amber-600/60'
                }`}>
                  {stats.colorBalanceScore}% Balanced
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total {packs.length} packs ({packs.reduce((acc, p) => acc + p.cards.length, 0)} cards)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              title={isSoundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Mythic Count Badge */}
            <div className="px-3.5 py-1.5 rounded-xl bg-orange-950/60 border border-orange-800/60 text-right">
              <span className="text-[10px] text-orange-300 uppercase tracking-wider block font-bold">
                Mythic Pulls
              </span>
              <span className="text-sm font-black font-mono text-orange-400 flex items-center justify-end gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {stats.mythicPacksCount} / {stats.totalPacks} ({stats.mythicRatePercent}%)
              </span>
            </div>

            <button
              onClick={onOpenPrintModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 hover:shadow-cyan-900/60 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Export PDF Sheets
            </button>
          </div>
        </div>

        {/* 7-Segment Color Breakdown Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
            <span className="font-medium text-slate-300">Color Representation across Box:</span>
            <span className="text-[11px] text-slate-500">
              Balanced collation minimizes mana starvation in draft packs
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {[
              { code: 'W', name: 'White', barColor: 'bg-amber-100 text-amber-950', border: 'border-amber-300' },
              { code: 'U', name: 'Blue', barColor: 'bg-blue-600 text-white', border: 'border-blue-400' },
              { code: 'B', name: 'Black', barColor: 'bg-neutral-800 text-neutral-100', border: 'border-neutral-600' },
              { code: 'R', name: 'Red', barColor: 'bg-rose-700 text-white', border: 'border-rose-400' },
              { code: 'G', name: 'Green', barColor: 'bg-emerald-700 text-white', border: 'border-emerald-400' },
              { code: 'Multicolor', name: 'Multi', barColor: 'bg-gradient-to-r from-amber-500 to-rose-500 text-white', border: 'border-amber-400' },
              { code: 'Colorless', name: 'Colorless', barColor: 'bg-zinc-700 text-zinc-100', border: 'border-zinc-500' },
            ].map(col => {
              const count = stats.colorDistribution[col.code] || 0;
              const avg = stats.averageColorPerPack[col.code] || 0;
              const totalCards = packs.reduce((acc, p) => acc + p.cards.length, 0);
              const pct = totalCards > 0 ? ((count / totalCards) * 100).toFixed(1) : 0;

              return (
                <div key={col.code} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-full ${col.barColor} border ${col.border}`} />
                      {col.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{count}</span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden my-1">
                    <div
                      className={`h-full ${col.barColor}`}
                      style={{ width: `${Math.min(100, (count / (totalCards / 6)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                    <span>{pct}%</span>
                    <span>~{avg}/pk</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pack Browser Header & Selector Carousel */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Packs:</span>
          {packs.map((pack, idx) => {
            const isSelected = idx === selectedPackIndex;
            return (
              <button
                key={pack.id}
                onClick={() => {
                  playClickSound();
                  setSelectedPackIndex(idx);
                }}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                #{pack.packNumber}
                {pack.hasMythic && (
                  <Sparkles className="w-3 h-3 text-orange-400 inline ml-1.5 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playClickSound();
              setSelectedPackIndex(prev => Math.max(0, prev - 1));
            }}
            disabled={selectedPackIndex === 0}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
            title="Previous pack (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 px-2">
            {selectedPackIndex + 1} of {packs.length}
          </span>
          <button
            onClick={() => {
              playClickSound();
              setSelectedPackIndex(prev => Math.min(packs.length - 1, prev + 1));
            }}
            disabled={selectedPackIndex === packs.length - 1}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
            title="Next pack (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleStartCeremony(selectedPackIndex)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-orange-950/50 hover:shadow-orange-900/60 active:scale-95 transition-all cursor-pointer ml-2"
          >
            <Flame className="w-3.5 h-3.5 text-amber-200" />
            Crack This Pack
          </button>
        </div>
      </div>

      {/* Interactive Pack Opening Ceremony Modal / View */}
      {isOpeningCeremony ? (
        <div className="relative bg-slate-950/95 border-2 border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between max-w-3xl mx-auto pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
                Pack #{currentPack.packNumber} Cracking Chamber
                {currentPack.hasMythic && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-600">
                    ★ Mythic Inside
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Revealed: {revealedCardCount} of {sortedCardsForOpening.length} cards (Press Space or Enter)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPackTorn ? (
                <>
                  <button
                    onClick={handleRevealNext}
                    disabled={revealedCardCount >= sortedCardsForOpening.length}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Reveal Next ({revealedCardCount + 1})
                  </button>
                  <button
                    onClick={handleRevealAll}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Reveal All
                  </button>
                </>
              ) : null}

              <button
                onClick={() => {
                  setIsOpeningCeremony(false);
                  setIsPackTorn(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Close (Esc)
              </button>
            </div>
          </div>

          {!isPackTorn ? (
            /* Physical Foil Booster Pack Wrapper Representation */
            <div className="py-12 flex flex-col items-center justify-center">
              <div
                onClick={handleTearPack}
                className="group relative w-64 h-96 rounded-2xl bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-4 border-amber-500/70 shadow-2xl p-4 flex flex-col items-center justify-between cursor-pointer select-none transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/20 active:scale-95 overflow-hidden"
              >
                {/* Crimped Foil edges */}
                <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 opacity-80" />
                <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 opacity-80" />

                {/* Holographic wrapper sheen */}
                <div className="absolute inset-0 foil-shimmer opacity-30 group-hover:opacity-70 transition-opacity" />

                <div className="text-center pt-3 z-10">
                  <span className="text-[11px] font-mono tracking-widest text-amber-300/80 uppercase font-black">
                    LIMITED EDITION
                  </span>
                  <h4 className="text-xl font-black text-white font-heading mt-1">
                    STAR WARS
                  </h4>
                  <span className="text-[10px] text-cyan-300 tracking-wider">TRADING CARD GAME</span>
                </div>

                <div className="w-24 h-24 rounded-full border-2 border-amber-400/50 bg-black/60 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform z-10">
                  <Flame className="w-12 h-12 text-amber-400 animate-pulse" />
                </div>

                <div className="text-center pb-3 z-10">
                  <div className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-lg group-hover:bg-amber-400 transition-colors">
                    CLICK TO TEAR PACK
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                    {sortedCardsForOpening.length} Collectible Cards
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-4">
                Click the booster foil pack to tear it open and reveal cards!
              </p>
            </div>
          ) : (
            /* Revealed Cards in authentic order */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedCardsForOpening.map((card, idx) => {
                const isRevealed = idx < revealedCardCount;

                return (
                  <div key={`${card.id}-${idx}`} className="transition-all duration-300">
                    <CardItem
                      card={card}
                      isFlipped={isRevealed}
                      showPackSlot={`#${idx + 1} (${card.rarity})`}
                      onClick={() => {
                        if (!isRevealed) {
                          handleRevealNext();
                        } else {
                          onInspectCard(card);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Regular Pack Overview Grid Display */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Cards in Pack #{currentPack.packNumber}:
            </span>
            <span className="text-[11px] text-slate-500">
              Click any card to inspect full oracle text and artist lore
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        </div>
      )}
    </div>
  );
};
