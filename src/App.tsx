import React, { useState, useEffect } from 'react';
import { Card, BoosterSlotConfig, BoosterPack } from './types/card';
import { STAR_WARS_SET } from './data/starWarsSet';
import { generateBoosterBox } from './utils/boosterCollation';
import { setSoundEnabled } from './utils/audioFeedback';
import { BoosterConfigurator } from './components/BoosterConfigurator';
import { BoosterSimulator } from './components/BoosterSimulator';
import { CardDatabase } from './components/CardDatabase';
import { CardModal } from './components/CardModal';
import { PrintSheetModal } from './components/PrintSheetModal';
import { Package, Database, Sparkles, Printer, RotateCcw, Shield, Github, Layers } from 'lucide-react';

const STORAGE_KEY_CARDS = 'cardforge_custom_cards_v1';
const STORAGE_KEY_CONFIG = 'cardforge_booster_config_v1';

const DEFAULT_CONFIG: BoosterSlotConfig = {
  commonsCount: 10,
  uncommonsCount: 3,
  raresCount: 1,
  mythicRatio: 0.22, // 1 in 4.5 packs (user specification)
  basicLandCount: 1,
  tokenCount: 0,
  balanceColorsInCommons: true,
};

export default function App() {
  const [cards, setCards] = useState<Card[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CARDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to load stored cards', e);
      }
    }
    return STAR_WARS_SET.cards;
  });

  const [config, setConfig] = useState<BoosterSlotConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load stored config', e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [packCount, setPackCount] = useState<number>(36); // Default 36-pack booster box
  const [packs, setPacks] = useState<BoosterPack[]>([]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'database'>('simulator');
  const [inspectingCard, setInspectingCard] = useState<Card | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Save cards to localStorage whenever modified
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
  }, [cards]);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }, [config]);

  // Generate initial box on initial load
  useEffect(() => {
    handleGeneratePacks();
  }, []);

  const handleGeneratePacks = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const generated = generateBoosterBox(packCount, cards, config);
      setPacks(generated);
      setIsGenerating(false);
    }, 50);
  };

  const handleResetToDefaultCards = () => {
    if (confirm('Reset custom card database back to original Star Wars TCG set? Any custom added cards will be reset.')) {
      setCards(STAR_WARS_SET.cards);
      localStorage.removeItem(STORAGE_KEY_CARDS);
    }
  };

  const handleAddCard = (newCard: Card) => {
    setCards(prev => [newCard, ...prev]);
  };

  const handleUpdateCard = (updatedCard: Card) => {
    setCards(prev => prev.map(c => (c.id === updatedCard.id ? updatedCard : c)));
  };

  const handleDeleteCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const handleImportCards = (importedCards: Card[]) => {
    setCards(importedCards);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/60 font-black text-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                CardForge
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  Booster Creator & Collation
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Star Wars TCG & Custom Card Booster Simulation & Print Sheet Generator
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Booster Packs ({packs.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Card Database ({cards.length})
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={packs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print PDF Sheets</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefaultCards}
              title="Reset Card Database to default Star Wars set"
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {activeTab === 'simulator' ? (
          <>
            {/* Slot & Collation Configurator */}
            <BoosterConfigurator
              config={config}
              onChange={setConfig}
              packCount={packCount}
              onPackCountChange={setPackCount}
              onGenerate={handleGeneratePacks}
              isGenerating={isGenerating}
            />

            {/* Booster Simulator & Collation Metrics */}
            <BoosterSimulator
              packs={packs}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onInspectCard={setInspectingCard}
              isSoundEnabled={isSoundEnabled}
              onToggleSound={() => {
                const next = !isSoundEnabled;
                setIsSoundEnabled(next);
                setSoundEnabled(next);
              }}
            />
          </>
        ) : (
          /* Card Database Management Tab */
          <CardDatabase
            cards={cards}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onInspectCard={setInspectingCard}
            onImportCards={handleImportCards}
          />
        )}
      </main>

      {/* Card Inspection Modal */}
      {inspectingCard && (
        <CardModal
          card={inspectingCard}
          onClose={() => setInspectingCard(null)}
          onEdit={updated => {
            handleUpdateCard(updated);
            setInspectingCard(null);
          }}
          onDelete={id => {
            handleDeleteCard(id);
            setInspectingCard(null);
          }}
        />
      )}

      {/* Print PDF Sheet Generator Modal */}
      {isPrintModalOpen && (
        <PrintSheetModal
          packs={packs}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <p>
            CardForge • Physical Card Stock Cutting PDF Sheets (Standard 63×88mm 2.5×3.5" Poker/MTG size)
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Color-Balanced Collation Engine</span>
            <span>•</span>
            <span>1 in 4.5 Mythic Ratio</span>
            <span>•</span>
            <span className="text-cyan-400">Deployable via GitHub Pages</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
