import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Card, BoosterSlotConfig, BoosterPack } from './types/card';
import { STAR_WARS_SET } from './data/starWarsSet';
import { generateBoosterBox } from './utils/boosterCollation';
import { setSoundEnabled } from './utils/audioFeedback';
import { BoosterConfigurator } from './components/BoosterConfigurator';
import { BoosterSimulator } from './components/BoosterSimulator';
import { CardDatabase } from './components/CardDatabase';
import { CardModal } from './components/CardModal';
import { CardEditorDialog } from './components/CardEditorDialog';
import { Button, IconButton } from './components/ui/Button';
import { useToast } from './components/ui/Toast';
import { cx } from './components/ui/cx';
import { Package, Database, Printer, RotateCcw } from 'lucide-react';

// jsPDF only loads when the print dialog is first opened.
const PrintSheetModal = lazy(() =>
  import('./components/PrintSheetModal').then(m => ({ default: m.PrintSheetModal }))
);

const STORAGE_KEY_CARDS = 'cardforge_custom_cards_v1';
const STORAGE_KEY_CARD_SET_VERSION = 'cardforge_card_set_version';
/** Bump when the built-in card set changes; databases saved with an older set are rebased onto the new one. */
const CARD_SET_VERSION = 2;
const STORAGE_KEY_CONFIG = 'cardforge_booster_config_v1';
const STORAGE_KEY_SOUND = 'cardforge_sound_v1';

const DEFAULT_CONFIG: BoosterSlotConfig = {
  commonsCount: 10,
  uncommonsCount: 3,
  raresCount: 1,
  mythicRatio: 0.22, // 1 in 4.5 packs (user specification)
  basicLandCount: 1,
  tokenCount: 0,
  balanceColorsInCommons: true,
  // Saved configs are merged over these defaults, so foils stay off for existing users.
  foilRate: 0,
};

type View = 'simulator' | 'database';
type EditorState = { mode: 'create' } | { mode: 'edit'; card: Card } | null;

function readStorage<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return parse(saved);
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
  }
  return fallback;
}

/** Built-in set cards come from the SWTG PDFs; anything else was created or imported by the user. */
const isSetCard = (card: Card) => (card.source ?? '').startsWith('swtg-');

/**
 * Load the saved card database. A database saved with an older built-in set keeps the
 * user's own cards and takes the current set for everything else.
 */
function loadCards(): { cards: Card[]; keptCustom: number | null } {
  const saved = readStorage<Card[] | null>(STORAGE_KEY_CARDS, null, raw => {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  });
  if (!saved) return { cards: STAR_WARS_SET.cards, keptCustom: null };
  const version = readStorage(STORAGE_KEY_CARD_SET_VERSION, 1, raw => Number(raw) || 1);
  if (version === CARD_SET_VERSION) return { cards: saved, keptCustom: null };
  const custom = saved.filter(c => !isSetCard(c));
  return { cards: [...custom, ...STAR_WARS_SET.cards], keptCustom: custom.length };
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
}

export default function App() {
  const toast = useToast();

  const [initialLoad] = useState(loadCards);
  const [cards, setCards] = useState<Card[]>(initialLoad.cards);

  const [config, setConfig] = useState<BoosterSlotConfig>(() =>
    readStorage(STORAGE_KEY_CONFIG, DEFAULT_CONFIG, raw => ({ ...DEFAULT_CONFIG, ...JSON.parse(raw) }))
  );

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() =>
    readStorage(STORAGE_KEY_SOUND, true, raw => raw !== 'false')
  );

  const [packCount, setPackCount] = useState<number>(36); // Default 36-pack booster box
  const [packs, setPacks] = useState<BoosterPack[]>([]);
  const [activeView, setActiveView] = useState<View>('simulator');
  const [inspecting, setInspecting] = useState<{ card: Card; artSeed?: number } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    writeStorage(STORAGE_KEY_CARDS, JSON.stringify(cards));
    writeStorage(STORAGE_KEY_CARD_SET_VERSION, String(CARD_SET_VERSION));
  }, [cards]);

  // Tell returning users their saved database moved to the updated card set.
  useEffect(() => {
    if (initialLoad.keptCustom === null) return;
    const kept = initialLoad.keptCustom;
    toast({
      message: `The card set was updated to ${STAR_WARS_SET.cards.length} cards.${
        kept > 0 ? ` Your ${kept} custom ${kept === 1 ? 'card was' : 'cards were'} kept.` : ''
      }`,
      duration: 8000,
    });
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    setSoundEnabled(isSoundEnabled);
    writeStorage(STORAGE_KEY_SOUND, String(isSoundEnabled));
  }, [isSoundEnabled]);

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
    const previous = cards;
    setCards(STAR_WARS_SET.cards);
    toast({
      message: `Card database reset to the original ${STAR_WARS_SET.cards.length} cards.`,
      actionLabel: 'Undo',
      onAction: () => setCards(previous),
    });
  };

  const handleSaveCard = (card: Card, isNew: boolean) => {
    setCards(prev => (isNew ? [card, ...prev] : prev.map(c => (c.id === card.id ? card : c))));
    setEditor(null);
    toast({ message: isNew ? `Added “${card.name}”.` : `Saved changes to “${card.name}”.` });
  };

  const handleDeleteCard = (cardId: string) => {
    const index = cards.findIndex(c => c.id === cardId);
    if (index === -1) return;
    const removed = cards[index];
    setCards(prev => prev.filter(c => c.id !== cardId));
    toast({
      message: `Deleted “${removed.name}”.`,
      actionLabel: 'Undo',
      onAction: () =>
        setCards(prev => (prev.some(c => c.id === removed.id) ? prev : [...prev.slice(0, index), removed, ...prev.slice(index)])),
    });
  };

  const handleImportCards = (importedCards: Card[]) => {
    const previous = cards;
    setCards(importedCards);
    toast({
      message: `Imported ${importedCards.length} cards. They replace your previous database.`,
      actionLabel: 'Undo',
      onAction: () => setCards(previous),
      duration: 8000,
    });
  };

  const navItems: { view: View; label: string; count: number; Icon: typeof Package }[] = [
    { view: 'simulator', label: 'Booster Packs', count: packs.length, Icon: Package },
    { view: 'database', label: 'Card Database', count: cards.length, Icon: Database },
  ];

  return (
    <div className="min-h-dvh bg-void text-fg flex flex-col font-sans">
      {/* No backdrop-filter below sm: it would turn the header into the containing block of the fixed bottom nav. */}
      <header className="sticky top-0 z-40 border-b border-line bg-void sm:bg-void/85 sm:backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center size-9 rounded-xl bg-accent text-accent-ink shrink-0" aria-hidden>
              <Package className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-wordmark text-fg-strong">CardForge</h1>
              <p className="hidden lg:block text-xs text-fg-muted truncate">
                Star Wars TCG booster simulator & print sheets
              </p>
            </div>
          </div>

          {/* One nav: inline in the header from sm up, docked to the bottom on phones */}
          <nav
            aria-label="Views"
            className={cx(
              'fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-1 border-t border-line bg-void/95 backdrop-blur-md px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]',
              'sm:static sm:z-auto sm:mx-auto sm:flex sm:gap-1 sm:rounded-xl sm:border sm:bg-well sm:p-1 sm:backdrop-blur-none'
            )}
          >
            {navItems.map(({ view, label, count, Icon }) => {
              const isActive = activeView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cx(
                    'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-3 min-h-12 sm:min-h-9 text-xs sm:text-sm font-semibold cursor-pointer transition-colors duration-150',
                    isActive
                      ? 'bg-accent-soft text-accent-fg sm:ring-1 sm:ring-accent-line'
                      : 'text-fg-muted hover:text-fg-strong hover:bg-raised'
                  )}
                >
                  <Icon aria-hidden className="size-5 sm:size-4" />
                  <span>
                    {label} <span className="tabular-nums text-fg-muted font-medium">({count})</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="ml-auto sm:ml-0 flex items-center gap-2">
            <Button
              onClick={() => setIsPrintModalOpen(true)}
              disabled={packs.length === 0}
              className="max-sm:hidden"
            >
              <Printer aria-hidden className="size-4" />
              Print sheets
            </Button>
            <IconButton
              label="Print sheets"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={packs.length === 0}
              className="sm:hidden"
            >
              <Printer aria-hidden className="size-4" />
            </IconButton>
            <IconButton label="Reset card database to the original set" onClick={handleResetToDefaultCards}>
              <RotateCcw aria-hidden className="size-4" />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {activeView === 'simulator' ? (
          <>
            <BoosterConfigurator
              cards={cards}
              config={config}
              onChange={setConfig}
              packCount={packCount}
              onPackCountChange={setPackCount}
              onGenerate={handleGeneratePacks}
              isGenerating={isGenerating}
            />

            <BoosterSimulator
              packs={packs}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onInspectCard={(card, artSeed) => setInspecting({ card, artSeed })}
              isSoundEnabled={isSoundEnabled}
              onToggleSound={() => setIsSoundEnabled(on => !on)}
            />
          </>
        ) : (
          <CardDatabase
            cards={cards}
            onCreateCard={() => setEditor({ mode: 'create' })}
            onEditCard={card => setEditor({ mode: 'edit', card })}
            onDeleteCard={handleDeleteCard}
            onInspectCard={card => setInspecting({ card })}
            onImportCards={handleImportCards}
          />
        )}
      </main>

      {inspecting && (
        <CardModal
          card={inspecting.card}
          artSeed={inspecting.artSeed}
          onClose={() => setInspecting(null)}
          // Pack cards are snapshots, so editing is only offered from the database.
          onEdit={
            activeView === 'database'
              ? card => {
                  setInspecting(null);
                  setEditor({ mode: 'edit', card });
                }
              : undefined
          }
          onDelete={
            activeView === 'database'
              ? id => {
                  setInspecting(null);
                  handleDeleteCard(id);
                }
              : undefined
          }
        />
      )}

      {editor && (
        <CardEditorDialog
          card={editor.mode === 'edit' ? editor.card : null}
          onCancel={() => setEditor(null)}
          onSave={handleSaveCard}
        />
      )}

      {isPrintModalOpen && (
        <Suspense fallback={null}>
          <PrintSheetModal packs={packs} onClose={() => setIsPrintModalOpen(false)} />
        </Suspense>
      )}

      <footer className="border-t border-line py-6 pb-28 sm:pb-6 text-xs text-fg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:justify-between gap-2">
          <p>
            Card designs and artwork from the{' '}
            <a
              href="https://www.starwarsthegathering.com/"
              target="_blank"
              rel="noreferrer"
              className="text-fg-soft underline decoration-line-strong underline-offset-3 hover:text-accent-fg hover:decoration-accent-fg"
            >
              Star Wars: The Gathering
            </a>{' '}
            fan project.
          </p>
          <p>Print sheets use the standard 63 × 88 mm card size (2.5 × 3.5 in).</p>
        </div>
      </footer>
    </div>
  );
}
