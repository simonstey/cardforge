import React from 'react';
import { BoosterSlotConfig } from '../types/card';
import { Sliders, Sparkles, Palette, ShieldCheck, RefreshCw, Box } from 'lucide-react';

interface BoosterConfiguratorProps {
  config: BoosterSlotConfig;
  onChange: (config: BoosterSlotConfig) => void;
  packCount: number;
  onPackCountChange: (count: number) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

export const BoosterConfigurator: React.FC<BoosterConfiguratorProps> = ({
  config,
  onChange,
  packCount,
  onPackCountChange,
  onGenerate,
  isGenerating,
}) => {
  const updateSlot = <K extends keyof BoosterSlotConfig>(key: K, value: BoosterSlotConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const mythicOneInX = config.mythicRatio > 0 ? (1 / config.mythicRatio).toFixed(1) : 'None';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Booster Slot & Collation Rules</h2>
            <p className="text-xs text-slate-400">Configure card slots, mythic frequency, and color balancing</p>
          </div>
        </div>

        {/* Total cards per pack readout */}
        <div className="text-right">
          <span className="text-xs text-slate-400">Cards / Pack</span>
          <div className="text-lg font-black font-mono text-cyan-300">
            {config.commonsCount + config.uncommonsCount + config.raresCount + config.basicLandCount + config.tokenCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card Slot Counts */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-slate-400" />
            Pack Slot Distribution
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                Commons (C)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.commonsCount}
                  onChange={e => updateSlot('commonsCount', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                Uncommons (U)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={config.uncommonsCount}
                  onChange={e => updateSlot('uncommonsCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Rare / Mythic Slot (R/M)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={config.raresCount}
                  onChange={e => updateSlot('raresCount', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Basic Land (L)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={config.basicLandCount}
                  onChange={e => updateSlot('basicLandCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                Token / Ad Slot
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={config.tokenCount}
                  onChange={e => updateSlot('tokenCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mythic Ratio & Frequency */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Mythic Replacement Rate
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-orange-950 text-orange-400 border border-orange-800/50">
                1 in {mythicOneInX} packs
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Standard request: 1 Mythic every 4–5 boosters instead of a Rare.
            </p>

            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.01}
              value={config.mythicRatio}
              onChange={e => updateSlot('mythicRatio', parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />

            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[
                { label: '1 in 4 (25%)', val: 0.25 },
                { label: '1 in 4.5 (22%)', val: 0.22 },
                { label: '1 in 5 (20%)', val: 0.20 },
                { label: '1 in 8 (12.5%)', val: 0.125 },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => updateSlot('mythicRatio', opt.val)}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                    Math.abs(config.mythicRatio - opt.val) < 0.015
                      ? 'bg-orange-950 text-orange-300 border-orange-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
            Probability: {(config.mythicRatio * 100).toFixed(1)}% per rare slot
          </div>
        </div>

        {/* Color Balancing Collation Algorithm */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                Color Balancing
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                config.balanceColorsInCommons
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {config.balanceColorsInCommons ? 'Active' : 'Randomized'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Ensures even distribution across W, U, B, R, G in each pack by seeding commons and auto-swapping to eliminate mono-color flood or color starvation.
            </p>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={config.balanceColorsInCommons}
                onChange={e => updateSlot('balanceColorsInCommons', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-200">
                Enforce Color-Balanced Commons & Anti-Clumping
              </span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[10px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Guarantees 1+ card of each color per pack when commons ≥ 5</span>
          </div>
        </div>
      </div>

      {/* Batch Generation Bar */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Packs to generate:</span>
          <div className="flex items-center gap-1">
            {[1, 3, 6, 12, 24, 36].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => onPackCountChange(num)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  packCount === num
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {num === 36 ? '36 (Box)' : num === 6 ? '6 (Sealed)' : num === 3 ? '3 (Draft)' : num}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={100}
            value={packCount}
            onChange={e => onPackCountChange(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-16 px-2 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-white ml-1"
          />
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 hover:shadow-cyan-900/60 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : `Generate ${packCount} ${packCount === 1 ? 'Pack' : 'Packs'}`}
        </button>
      </div>
    </div>
  );
};
