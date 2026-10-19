import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import { BoosterPack, Card } from '../types/card';
import { CardItem } from './CardItem';
import { computeCollationStats } from '../utils/boosterCollation';
import { MANA, MANA_ORDER, RARITY } from '../utils/cardHelpers';
import { getCardArt } from '../utils/cardArt';
import { STAR_WARS_SET } from '../data/starWarsSet';
import { playCardFlipSound, playPackRipSound, playMythicChimeSound, playClickSound } from '../utils/audioFeedback';
import { Button, IconButton } from './ui/Button';
import { cx } from './ui/cx';
import { Package, Sparkles, ChevronRight, ChevronLeft, BarChart3, Volume2, VolumeX, Printer, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BoosterSimulatorProps {
  packs: BoosterPack[];
  onOpenPrintModal: () => void;
  onInspectCard: (card: Card, artSeed?: number) => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
}

interface Ceremony {
  torn: boolean;
  revealed: number;
}

/** Opening order: tokens and lands first, then commons, uncommons, and the rare or mythic last. */
const OPENING_ORDER: Record<string, number> = { T: 1, L: 2, C: 3, U: 4, R: 5, M: 6 };

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Keys typed into a form control belong to that control. */
function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Space/Enter on any interactive element should activate that element, not the global shortcut. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return isFormControl(target) || !!target.closest('button, a[href], summary, [role="button"]');
}

// Key art on the booster wrapper.
const PACK_ART = (() => {
  const vader = STAR_WARS_SET.cards.find(c => c.name === 'Anakin Skywalker // Darth Vader');
  return vader ? getCardArt(vader) : null;
})();

const formatShare = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%');

export const BoosterSimulator: React.FC<BoosterSimulatorProps> = ({
  packs,
  onOpenPrintModal,
  onInspectCard,
  isSoundEnabled,
  onToggleSound,
}) => {
  const id = useId();
  const [selectedPackIndex, setSelectedPackIndex] = useState<number>(0);
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [isTearing, setIsTearing] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const packWrapperRef = useRef<HTMLButtonElement>(null);
  const revealNextRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => computeCollationStats(packs), [packs]);
  const safeIndex = Math.min(selectedPackIndex, Math.max(0, packs.length - 1));
  const currentPack = packs[safeIndex];

  const openingOrder = useMemo(
    () =>
      currentPack
        ? [...currentPack.cards].sort((a, b) => (OPENING_ORDER[a.rarity] || 3) - (OPENING_ORDER[b.rarity] || 3))
        : [],
    [currentPack]
  );

  const foilIds = useMemo(() => new Set(currentPack?.foilCardIds ?? []), [currentPack]);

  // A new box resets the browser to its first pack.
  useEffect(() => {
    setSelectedPackIndex(0);
    setCeremony(null);
  }, [packs]);

  // Keep the selected pack chip in view.
  useEffect(() => {
    const chip = stripRef.current?.querySelector<HTMLElement>(`[data-pack="${safeIndex}"]`);
    chip?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [safeIndex]);

  // Move focus to the control the next step needs.
  const total = openingOrder.length;
  useEffect(() => {
    if (!ceremony) return;
    if (!ceremony.torn) packWrapperRef.current?.focus();
    else if (ceremony.revealed >= total) doneRef.current?.focus();
    else if (ceremony.revealed === 0) revealNextRef.current?.focus();
  }, [ceremony?.torn, ceremony !== null, ceremony?.revealed === total]);

  const selectPack = (index: number) => {
    playClickSound();
    setSelectedPackIndex(Math.max(0, Math.min(packs.length - 1, index)));
  };

  const startCeremony = () => {
    playClickSound();
    setCeremony({ torn: false, revealed: 0 });
    setAnnouncement(`Pack ${currentPack.packNumber} is ready to open.`);
  };

  const closeCeremony = useCallback(() => {
    setCeremony(null);
    setIsTearing(false);
    requestAnimationFrame(() => openButtonRef.current?.focus());
  }, []);

  const tearPack = useCallback(() => {
    if (isTearing) return;
    playPackRipSound();
    const finish = () => {
      setIsTearing(false);
      setCeremony({ torn: true, revealed: 0 });
      setAnnouncement(`Pack torn open. ${total} cards face down.`);
    };
    if (prefersReducedMotion()) {
      finish();
    } else {
      setIsTearing(true);
      window.setTimeout(finish, 320);
    }
  }, [isTearing, total]);

  const celebrateMythic = () => {
    playMythicChimeSound();
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#fb923c', '#fbbf24', '#f472b6', '#ffffff'],
      disableForReducedMotion: true,
    });
  };

  // Read through a ref so rapid key repeats never reveal the same card twice.
  const ceremonyRef = useRef(ceremony);
  ceremonyRef.current = ceremony;

  const revealNext = useCallback(() => {
    const c = ceremonyRef.current;
    if (!c || !c.torn || c.revealed >= total) return;
    const card = openingOrder[c.revealed];
    if (card.rarity === 'M') celebrateMythic();
    else playCardFlipSound();
    setAnnouncement(
      `Card ${c.revealed + 1} of ${total}: ${card.name}, ${RARITY[card.rarity].label}${foilIds.has(card.id) ? ', foil' : ''}.`
    );
    const next = { ...c, revealed: c.revealed + 1 };
    ceremonyRef.current = next;
    setCeremony(next);
  }, [openingOrder, total, foilIds]);

  const revealAll = () => {
    if (!ceremony) return;
    const remaining = openingOrder.slice(ceremony.revealed);
    playCardFlipSound();
    if (remaining.some(c => c.rarity === 'M')) celebrateMythic();
    setCeremony({ ...ceremony, revealed: total });
    setAnnouncement(`All ${total} cards revealed.`);
  };

  // Keyboard shortcuts: arrows browse packs, Space/Enter advance the opening, Escape closes it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('dialog[open]')) return;

      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !ceremony && !isFormControl(e.target)) {
        e.preventDefault();
        setSelectedPackIndex(i => Math.max(0, Math.min(packs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))));
      } else if ((e.key === ' ' || e.key === 'Enter') && ceremony && !isInteractive(e.target)) {
        e.preventDefault();
        if (!ceremony.torn) tearPack();
        else revealNext();
      } else if (e.key === 'Escape' && ceremony) {
        closeCeremony();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ceremony, packs.length, tearPack, revealNext, closeCeremony]);

  if (packs.length === 0 || !currentPack) {
    return (
      <section className="rounded-2xl border border-line bg-panel/60 px-6 py-14 text-center max-w-2xl mx-auto">
        <Package aria-hidden className="size-8 mx-auto mb-3 text-fg-muted" />
        <h2 className="text-section text-fg-strong">No booster packs yet</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Set the slot rules above, then choose Generate to collate a box.
        </p>
      </section>
    );
  }

  const maxBucket = Math.max(1, ...MANA_ORDER.map(c => stats.colorDistribution[c] || 0));
  const isComplete = ceremony?.torn && ceremony.revealed >= total;

  return (
    <div className="space-y-6">
      {/* Box collation summary */}
      <section aria-labelledby={`${id}-stats`} className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-10 rounded-xl border border-indigo-700/60 bg-indigo-950/80 text-indigo-300" aria-hidden>
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h2 id={`${id}-stats`} className="text-section text-fg-strong">
                Box collation
              </h2>
              <p className="text-sm text-fg-muted">
                {stats.totalPacks} packs · {stats.totalCards} cards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              label={isSoundEnabled ? 'Mute sound effects' : 'Turn on sound effects'}
              aria-pressed={isSoundEnabled}
              onClick={onToggleSound}
            >
              {isSoundEnabled ? (
                <Volume2 aria-hidden className="size-4 text-accent-fg" />
              ) : (
                <VolumeX aria-hidden className="size-4" />
              )}
            </IconButton>
            <Button onClick={onOpenPrintModal}>
              <Printer aria-hidden className="size-4" />
              Print sheets
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-line bg-well/70 px-4 py-3">
            <dt className="text-xs text-fg-muted">Color balance</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold proportional-nums text-fg-strong">{stats.colorBalanceScore}%</span>
              <span className={cx('text-xs font-semibold', stats.colorBalanceScore >= 85 ? 'text-success' : 'text-warning')}>
                {stats.colorBalanceScore >= 85 ? 'Even' : 'Uneven'}
              </span>
            </dd>
            <dd className="mt-1 text-xs text-fg-muted">
              How evenly W, U, B, R and G appear among playable cards. 100% = equal; lands and tokens don’t count.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-well/70 px-4 py-3">
            <dt className="text-xs text-fg-muted">Mythic packs</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold proportional-nums text-fg-strong">{stats.mythicPacksCount}</span>
              <span className="text-xs text-fg-muted">of {stats.totalPacks}</span>
            </dd>
            <dd className="mt-1 text-xs text-fg-muted">
              {stats.mythicRatePercent}% of packs
              {stats.totalMythics !== stats.mythicPacksCount && ` · ${stats.totalMythics} mythics in total`}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-well/70 px-4 py-3">
            <dt className="text-xs text-fg-muted">Foil packs</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold proportional-nums text-fg-strong">{stats.foilPacksCount}</span>
              <span className="text-xs text-fg-muted">of {stats.totalPacks}</span>
            </dd>
            <dd className="mt-1 text-xs text-fg-muted">
              {stats.foilPacksCount > 0 ? 'A foil replaces one common' : 'Foils are off in the slot rules'}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-well/70 px-4 py-3">
            <dt className="text-xs text-fg-muted">Average pack</dt>
            <dd className="mt-0.5 text-2xl font-bold proportional-nums text-fg-strong">
              {(stats.totalCards / Math.max(1, stats.totalPacks)).toFixed(stats.totalCards % Math.max(1, stats.totalPacks) ? 1 : 0)}
              <span className="ml-1.5 text-xs font-normal text-fg-muted">cards</span>
            </dd>
          </div>
        </dl>

        {/* Color distribution: a table with an inline bar per row (the bars share one scale) */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left pb-2">
              <span className="font-semibold text-fg">Color distribution across the box</span>
              <span className="block text-xs text-fg-muted">
                Each card is counted once. Multicolor cards have their own row; “In cards” also counts them under each of
                their colors.
              </span>
            </caption>
            <thead>
              <tr className="text-xs text-fg-muted border-b border-line">
                <th scope="col" className="py-2 pr-3 text-left font-medium">Color</th>
                <th scope="col" className="py-2 pr-3 text-left font-medium w-[34%] sm:w-[40%]">
                  <span className="sr-only">Share of cards</span>
                </th>
                <th scope="col" className="py-2 px-2 sm:px-3 text-right font-medium">Cards</th>
                <th scope="col" className="py-2 pl-2 sm:px-3 text-right font-medium">Share</th>
                <th scope="col" className="py-2 px-3 text-right font-medium max-sm:hidden">Per pack</th>
                <th scope="col" className="py-2 pl-3 text-right font-medium max-sm:hidden">In cards</th>
              </tr>
            </thead>
            <tbody>
              {MANA_ORDER.map(c => {
                const count = stats.colorDistribution[c] || 0;
                const presence = c in stats.colorPresence ? stats.colorPresence[c as keyof typeof stats.colorPresence] : null;
                return (
                  <tr key={c} className="group border-b border-line/60 last:border-0 hover:bg-raised/40 transition-colors duration-100">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-fg whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className={cx('size-3 rounded-full ring-1 ring-black/40', MANA[c].swatch)} />
                        {MANA[c].label}
                      </span>
                      {/* Phones: the two right-hand columns move under the name */}
                      <span className="block pl-5 text-xs font-normal text-fg-muted sm:hidden">
                        {(stats.averageColorPerPack[c] || 0).toFixed(1)} per pack{presence !== null && ` · in ${presence}`}
                      </span>
                    </th>
                    <td className="py-2 pr-3" aria-hidden>
                      <div className="h-2 rounded-r-[4px] bg-accent/80 group-hover:bg-accent transition-colors duration-100" style={{ width: `${(count / maxBucket) * 100}%` }} />
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right text-fg">{count}</td>
                    <td className="py-2 pl-2 sm:px-3 text-right text-fg-soft">{formatShare(count, stats.totalCards)}</td>
                    <td className="py-2 px-3 text-right text-fg-soft max-sm:hidden">{(stats.averageColorPerPack[c] || 0).toFixed(1)}</td>
                    <td className="py-2 pl-3 text-right text-fg-muted max-sm:hidden">{presence ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pack browser */}
      <section aria-labelledby={`${id}-packs`} className="space-y-4">
        <div className="rounded-2xl border border-line bg-panel/80 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${id}-packs`} className="text-section text-fg-strong">
              Pack {currentPack.packNumber}
              {currentPack.hasMythic && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-rarity-m-line/70 bg-rarity-m-soft px-2 py-0.5 align-middle text-xs font-semibold text-rarity-m">
                  <Sparkles aria-hidden className="size-3" />
                  Mythic inside
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <IconButton
                label="Previous pack"
                aria-keyshortcuts="ArrowLeft"
                onClick={() => selectPack(safeIndex - 1)}
                disabled={safeIndex === 0 || !!ceremony}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </IconButton>
              <span className="min-w-14 text-center text-sm font-semibold text-fg-soft" aria-live="polite">
                {safeIndex + 1} of {packs.length}
              </span>
              <IconButton
                label="Next pack"
                aria-keyshortcuts="ArrowRight"
                onClick={() => selectPack(safeIndex + 1)}
                disabled={safeIndex === packs.length - 1 || !!ceremony}
              >
                <ChevronRight aria-hidden className="size-4" />
              </IconButton>
              {!ceremony && (
                <Button ref={openButtonRef} variant="foil" size="md" onClick={startCeremony} className="ml-1">
                  <Package aria-hidden className="size-4" />
                  Open this pack
                </Button>
              )}
            </div>
          </div>

          <div
            ref={stripRef}
            role="group"
            aria-label="Choose a pack"
            className="flex gap-1.5 overflow-x-auto scroll-px-2 pb-1 -mx-1 px-1 [scrollbar-width:thin]"
          >
            {packs.map((pack, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={pack.id}
                  type="button"
                  data-pack={idx}
                  aria-pressed={isSelected}
                  disabled={!!ceremony && !isSelected}
                  onClick={() => selectPack(idx)}
                  className={cx(
                    'relative inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 min-h-9 pointer-coarse:min-h-11 text-control font-semibold cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
                    isSelected
                      ? 'bg-accent-soft text-accent-fg border-accent-line'
                      : 'bg-well text-fg-muted border-line hover:border-line-strong hover:text-fg'
                  )}
                >
                  #{pack.packNumber}
                  {pack.hasMythic && (
                    <>
                      <Sparkles aria-hidden className="size-3 text-rarity-m" />
                      <span className="sr-only">, has a mythic</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        {ceremony ? (
          <div className="rounded-3xl border border-line-strong bg-well p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
              <div>
                <h3 className="text-section text-fg-strong">Opening pack {currentPack.packNumber}</h3>
                <p className="text-sm text-fg-muted">
                  {ceremony.torn
                    ? `${ceremony.revealed} of ${total} revealed · Space or Enter reveals the next card`
                    : 'Tear the wrapper to start · Space or Enter works too'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ceremony.torn && !isComplete && (
                  <>
                    <Button ref={revealNextRef} variant="primary" size="md" onClick={revealNext}>
                      Reveal next
                    </Button>
                    <Button size="md" onClick={revealAll}>
                      Reveal all
                    </Button>
                  </>
                )}
                {isComplete ? (
                  <Button ref={doneRef} variant="primary" size="md" onClick={closeCeremony}>
                    Done
                  </Button>
                ) : (
                  <Button variant="ghost" size="md" onClick={closeCeremony} aria-keyshortcuts="Escape">
                    <X aria-hidden className="size-4" />
                    Close
                  </Button>
                )}
              </div>
            </div>

            {!ceremony.torn ? (
              <div className="flex flex-col items-center py-6 sm:py-10">
                <button
                  ref={packWrapperRef}
                  type="button"
                  onClick={tearPack}
                  aria-label={`Tear open pack ${currentPack.packNumber}, ${total} cards`}
                  className={cx(
                    'group relative w-52 sm:w-60 aspect-[5/8] overflow-hidden rounded-2xl border-2 border-foil/70 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950',
                    'shadow-2xl shadow-black/70 cursor-pointer select-none',
                    'transition-[translate,scale,opacity] duration-300 ease-out-expo hover:-translate-y-1 active:scale-[0.98] motion-reduce:hover:translate-y-0',
                    isTearing && 'scale-95 opacity-0'
                  )}
                >
                  {PACK_ART && (
                    <img
                      src={PACK_ART.src}
                      alt=""
                      className="absolute inset-x-0 top-[22%] h-[46%] w-full object-cover opacity-80 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_70%,transparent)]"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cx(
                      'absolute inset-x-0 top-0 h-5 bg-[repeating-linear-gradient(90deg,var(--color-amber-600)_0_6px,var(--color-amber-300)_6px_9px)] opacity-90',
                      'transition-[translate,rotate] duration-300 ease-out-expo origin-left',
                      isTearing && '-translate-y-6 -rotate-6'
                    )}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-5 bg-[repeating-linear-gradient(90deg,var(--color-amber-600)_0_6px,var(--color-amber-300)_6px_9px)] opacity-90"
                  />
                  <span aria-hidden className="foil-sheen absolute inset-0 group-hover:bg-position-[0%_0%]" />

                  <span className="absolute inset-x-0 top-9 flex flex-col items-center text-center">
                    <span className="text-label uppercase text-foil">Booster pack</span>
                    <span className="mt-1 text-2xl font-extrabold font-stretch-semi-condensed text-fg-strong">
                      Star Wars TCG
                    </span>
                  </span>

                  <span className="absolute inset-x-0 bottom-9 flex flex-col items-center gap-2">
                    <span className="rounded-full bg-foil px-4 py-1.5 text-sm font-bold text-foil-ink shadow-lg group-hover:bg-foil-hover transition-colors duration-150">
                      Tear open
                    </span>
                    <span className="text-xs text-fg-soft">{total} cards</span>
                  </span>
                </button>
              </div>
            ) : (
              <ul className="card-grid">
                {openingOrder.map((card, idx) => {
                  const isRevealed = idx < ceremony.revealed;
                  return (
                    <li
                      key={`${card.id}-${idx}`}
                      className="transition-[opacity,translate] duration-300 ease-out-expo starting:opacity-0 starting:translate-y-3 motion-reduce:starting:translate-y-0"
                      style={{ transitionDelay: `${Math.min(idx, 14) * 30}ms` }}
                    >
                      <CardItem
                        card={card}
                        flippable
                        faceDown={!isRevealed}
                        isFoil={foilIds.has(card.id)}
                        artSeed={currentPack.packNumber * 31 + currentPack.cards.indexOf(card)}
                        label={isRevealed ? undefined : `Reveal card ${idx + 1} of ${total}`}
                        onClick={() =>
                          isRevealed
                            ? onInspectCard(card, currentPack.packNumber * 31 + currentPack.cards.indexOf(card))
                            : revealNext()
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-fg-muted">Select a card to see its full rules text and artwork.</p>
            <ul className="card-grid">
              {currentPack.cards.map((card, idx) => (
                <li key={`${card.id}-${idx}`}>
                  <CardItem
                    card={card}
                    isFoil={foilIds.has(card.id)}
                    artSeed={currentPack.packNumber * 31 + idx}
                    onClick={() => onInspectCard(card, currentPack.packNumber * 31 + idx)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};
