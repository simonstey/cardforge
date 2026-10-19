import React, { useId, useMemo } from 'react';
import { BoosterSlotConfig, Card } from '../types/card';
import { listCardSets } from '../utils/boosterCollation';
import { SET_NAMES } from '../utils/cardHelpers';
import { playClickSound } from '../utils/audioFeedback';
import { Button, ToggleChip } from './ui/Button';
import { Stepper } from './ui/Stepper';
import { Sliders, Sparkles, Palette, ShieldCheck, RefreshCw, Box, Gem, Library } from 'lucide-react';

interface BoosterConfiguratorProps {
  /** The card pool, for the set picker. */
  cards: Card[];
  config: BoosterSlotConfig;
  onChange: (config: BoosterSlotConfig) => void;
  packCount: number;
  onPackCountChange: (count: number) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

type SlotKey = 'commonsCount' | 'uncommonsCount' | 'raresCount' | 'basicLandCount' | 'tokenCount';

const SLOTS: { key: SlotKey; label: string; noun: string; min: number; max: number; dot: string; hint?: string }[] = [
  { key: 'commonsCount', label: 'Commons', noun: 'commons', min: 1, max: 20, dot: 'bg-rarity-c' },
  { key: 'uncommonsCount', label: 'Uncommons', noun: 'uncommons', min: 0, max: 10, dot: 'bg-rarity-u' },
  { key: 'raresCount', label: 'Rare or mythic', noun: 'rare slots', min: 1, max: 5, dot: 'bg-rarity-r' },
  { key: 'basicLandCount', label: 'Basic lands', noun: 'basic lands', min: 0, max: 5, dot: 'bg-rarity-l' },
  { key: 'tokenCount', label: 'Tokens', noun: 'tokens', min: 0, max: 3, dot: 'bg-rarity-t', hint: 'Left out if the pool has no tokens' },
];

const MYTHIC_PRESETS = [
  { label: '1 in 4', val: 0.25 },
  { label: '1 in 4.5', val: 0.22 },
  { label: '1 in 5', val: 0.2 },
  { label: '1 in 8', val: 0.125 },
];

const FOIL_PRESETS = [
  { label: 'Off', val: 0 },
  { label: '1 in 6', val: 1 / 6 },
  { label: '1 in 3', val: 1 / 3 },
];

const PACK_PRESETS: { count: number; label: string }[] = [
  { count: 1, label: '1' },
  { count: 3, label: '3 · Draft' },
  { count: 6, label: '6 · Sealed' },
  { count: 12, label: '12' },
  { count: 24, label: '24' },
  { count: 36, label: '36 · Box' },
];

const PANEL = 'rounded-xl border border-line/80 bg-well/60 p-4';
const PANEL_TITLE = 'flex items-center gap-2 text-group uppercase text-fg-soft';

export const BoosterConfigurator: React.FC<BoosterConfiguratorProps> = ({
  cards,
  config,
  onChange,
  packCount,
  onPackCountChange,
  onGenerate,
  isGenerating,
}) => {
  const id = useId();
  const updateSlot = <K extends keyof BoosterSlotConfig>(key: K, value: BoosterSlotConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const oneIn = config.mythicRatio > 0 ? +(1 / config.mythicRatio).toFixed(1) : null;
  const mythicPercent = (config.mythicRatio * 100).toFixed(1);
  const cardsPerPack = SLOTS.reduce((sum, s) => sum + config[s.key], 0);
  const foilRate = config.foilRate ?? 0;

  const sets = useMemo(() => listCardSets(cards), [cards]);
  const selectedSets = config.includedSets?.length ? config.includedSets : sets.map(s => s.code);
  const toggleSet = (code: string, on: boolean) => {
    const next = on ? [...selectedSets, code] : selectedSets.filter(c => c !== code);
    if (next.length === 0) return; // at least one set must stay selected
    // Every set selected is stored as "no filter", so newly imported sets are included too.
    updateSlot('includedSets', next.length === sets.length ? undefined : next);
  };

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center size-10 rounded-xl border border-accent-line/60 bg-accent-soft text-accent-fg" aria-hidden>
            <Sliders className="size-5" />
          </div>
          <div>
            <h2 id={`${id}-title`} className="text-section text-fg-strong">
              Booster slots & collation
            </h2>
            <p className="text-sm text-fg-muted">
              How many cards fill each slot, how often a mythic replaces the rare, and how commons are balanced.
            </p>
          </div>
        </div>

        <dl className="text-right shrink-0">
          <dt className="text-xs text-fg-muted">Cards per pack</dt>
          <dd className="text-2xl font-bold tabular-nums text-accent-fg leading-tight">{cardsPerPack}</dd>
        </dl>
      </div>

      {/* Columns follow the content width (rem-based), so large text settings reflow instead of overlapping */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-4">
        <fieldset className={PANEL}>
          <legend className="sr-only">Pack slots</legend>
          <h3 aria-hidden className={`${PANEL_TITLE} mb-3`}>
            <Box className="size-4 text-fg-muted" />
            Pack slots
          </h3>
          <div className="space-y-2">
            {SLOTS.map(slot => (
              <div key={slot.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor={`${id}-${slot.key}`} className="flex items-center gap-2 text-sm text-fg-soft">
                  <span aria-hidden className={`size-2.5 rounded-full ${slot.dot}`} />
                  <span>
                    {slot.label}
                    {slot.hint && <span className="block text-xs text-fg-muted">{slot.hint}</span>}
                  </span>
                </label>
                <Stepper
                  id={`${id}-${slot.key}`}
                  value={config[slot.key]}
                  min={slot.min}
                  max={slot.max}
                  noun={slot.noun}
                  onChange={v => updateSlot(slot.key, v)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div className={`${PANEL} flex flex-col`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={PANEL_TITLE}>
              <Sparkles aria-hidden className="size-4 text-rarity-m" />
              Mythic upgrade rate
            </h3>
            <span className="rounded-md border border-rarity-m-line/70 bg-rarity-m-soft px-2 py-0.5 text-xs font-bold tabular-nums text-rarity-m">
              {oneIn ? `1 in ${oneIn} packs` : 'Never'}
            </span>
          </div>

          <p className="text-sm text-fg-muted mb-4">
            Chance that a rare slot holds a mythic instead. The default is 1 in 4.5 packs.
          </p>

          <label htmlFor={`${id}-mythic`} className="sr-only">
            Mythic upgrade chance
          </label>
          <input
            id={`${id}-mythic`}
            type="range"
            min={0.05}
            max={0.5}
            step={0.005}
            value={config.mythicRatio}
            aria-valuetext={`${mythicPercent}%, about 1 in ${oneIn} packs`}
            onChange={e => updateSlot('mythicRatio', parseFloat(e.target.value))}
            className="w-full accent-rarity-m cursor-pointer h-6"
          />

          <div role="group" aria-label="Mythic rate presets" className="grid grid-cols-4 gap-1.5 mt-3">
            {MYTHIC_PRESETS.map(opt => (
              <ToggleChip
                key={opt.val}
                tone="mythic"
                selected={Math.abs(config.mythicRatio - opt.val) < 0.003}
                onClick={() => {
                  playClickSound();
                  updateSlot('mythicRatio', opt.val);
                }}
                className="px-1"
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>

          <p className="mt-auto pt-3 border-t border-line/80 text-xs text-fg-muted tabular-nums">
            {mythicPercent}% per rare slot
          </p>
        </div>

        <div className={`${PANEL} flex flex-col`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={PANEL_TITLE}>
              <Palette aria-hidden className="size-4 text-accent-fg" />
              Color balancing
            </h3>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                config.balanceColorsInCommons
                  ? 'border-emerald-800/60 bg-emerald-950 text-success'
                  : 'border-line bg-panel text-fg-muted'
              }`}
            >
              {config.balanceColorsInCommons ? 'On' : 'Off'}
            </span>
          </div>

          <p className="text-sm text-fg-muted mb-4">
            Commons are drawn so no color floods the pack: with 10 commons, no color appears more than 3 times.
          </p>

          <label className="flex items-center gap-3 rounded-lg border border-line bg-panel/80 p-3 min-h-11 cursor-pointer hover:border-line-strong transition-colors duration-150">
            <input
              type="checkbox"
              checked={config.balanceColorsInCommons}
              onChange={e => updateSlot('balanceColorsInCommons', e.target.checked)}
              className="size-4 shrink-0 cursor-pointer"
            />
            <span className="text-sm font-medium text-fg">Balance colors in commons</span>
          </label>

          <p className="mt-auto pt-3 border-t border-line/80 flex items-start gap-2 text-xs text-success">
            <ShieldCheck aria-hidden className="size-4 shrink-0" />
            With 5 or more commons, every pack gets at least one card of each color.
          </p>
        </div>

        <div className={`${PANEL} flex flex-col`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={PANEL_TITLE}>
              <Gem aria-hidden className="size-4 text-rarity-t" />
              Foils
            </h3>
            <span className="rounded-md border border-line bg-panel px-2 py-0.5 text-xs font-bold text-fg-soft">
              {foilRate > 0 ? `1 in ${+(1 / foilRate).toFixed(1)} packs` : 'Off'}
            </span>
          </div>
          <p className="text-sm text-fg-muted mb-4">
            A foil replaces one common. Its rarity follows the pack’s common, uncommon, rare and mythic mix.
          </p>
          <div role="group" aria-label="Foil rate" className="grid grid-cols-3 gap-1.5">
            {FOIL_PRESETS.map(opt => (
              <ToggleChip
                key={opt.label}
                selected={Math.abs(foilRate - opt.val) < 0.003}
                onClick={() => {
                  playClickSound();
                  updateSlot('foilRate', opt.val);
                }}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </div>

        <fieldset className={PANEL}>
          <legend className="sr-only">Sets in packs</legend>
          <h3 aria-hidden className={`${PANEL_TITLE} mb-2`}>
            <Library className="size-4 text-fg-muted" />
            Sets in packs
          </h3>
          <p className="text-sm text-fg-muted mb-3">
            Packs draw from every selected set together. Sets without basic lands or tokens borrow them from the rest
            of the pool.
          </p>
          <div className="flex flex-wrap gap-2">
            {sets.map(set => {
              const checked = selectedSets.includes(set.code);
              const isLast = checked && selectedSets.length === 1;
              return (
                <label
                  key={set.code}
                  title={isLast ? 'At least one set must stay selected' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 min-h-10 pointer-coarse:min-h-11 text-sm cursor-pointer transition-colors duration-150 ${
                    checked ? 'border-accent-line/70 bg-accent-soft/50 text-fg' : 'border-line bg-panel/80 text-fg-muted hover:border-line-strong'
                  } ${isLast ? 'cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLast}
                    onChange={e => toggleSet(set.code, e.target.checked)}
                    className="size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>
                    {SET_NAMES[set.code] ?? set.code} <span className="text-fg-muted">({set.count})</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${id}-packs-label`} className="text-sm text-fg-soft">
            Packs to generate
          </span>
          <div role="group" aria-labelledby={`${id}-packs-label`} className="flex flex-wrap items-center gap-1.5">
            {PACK_PRESETS.map(p => (
              <ToggleChip
                key={p.count}
                selected={packCount === p.count}
                onClick={() => {
                  playClickSound();
                  onPackCountChange(p.count);
                }}
              >
                {p.label}
              </ToggleChip>
            ))}
          </div>
          <label htmlFor={`${id}-packcount`} className="sr-only">
            Custom pack count
          </label>
          <Stepper
            id={`${id}-packcount`}
            value={packCount}
            min={1}
            max={100}
            noun="packs"
            onChange={onPackCountChange}
          />
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            playClickSound();
            onGenerate();
          }}
          disabled={isGenerating}
          className="max-sm:w-full"
        >
          <RefreshCw aria-hidden className={`size-4 ${isGenerating ? 'motion-safe:animate-spin' : ''}`} />
          {isGenerating ? 'Generating…' : `Generate ${packCount} ${packCount === 1 ? 'pack' : 'packs'}`}
        </Button>
      </div>
    </section>
  );
};
