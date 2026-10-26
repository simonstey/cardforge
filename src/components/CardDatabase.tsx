import React, { useState, useMemo, useRef, useId } from 'react';
import { Card, Rarity, CardColor } from '../types/card';
import { CardItem } from './CardItem';
import { MANA, MANA_ORDER, RARITY, RARITY_ORDER } from '../utils/cardHelpers';
import { playClickSound } from '../utils/audioFeedback';
import { normalizeImportedCard } from '../utils/cardImport';
import { plainRulesText } from '../utils/rulesText';
import { Button, IconButton, ToggleChip } from './ui/Button';
import { useToast } from './ui/Toast';
import { Search, Plus, Download, Upload, Pencil, Trash2, Database, SearchX, CloudDownload } from 'lucide-react';

interface CardDatabaseProps {
  cards: Card[];
  onCreateCard: () => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (id: string) => void;
  onInspectCard: (card: Card) => void;
  onImportCards: (cards: Card[]) => void;
  onOpenScryfallImport: () => void;
}

type RarityFilter = Rarity | 'ALL';
type ColorFilter = CardColor | 'ALL';

export const CardDatabase: React.FC<CardDatabaseProps> = ({
  cards,
  onCreateCard,
  onEditCard,
  onDeleteCard,
  onInspectCard,
  onImportCards,
  onOpenScryfallImport,
}) => {
  const id = useId();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRarity, setSelectedRarity] = useState<RarityFilter>('ALL');
  const [selectedColor, setSelectedColor] = useState<ColorFilter>('ALL');

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cards.filter(card => {
      if (query) {
        const haystack = [card.name, plainRulesText(card.text || ''), card.type, card.artist, card.backFace?.name].map(v =>
          (v || '').toLowerCase()
        );
        if (!haystack.some(v => v.includes(query))) return false;
      }

      if (selectedRarity !== 'ALL' && card.rarity !== selectedRarity) return false;

      if (selectedColor !== 'ALL') {
        const colors = card.colors || ['Colorless'];
        if (selectedColor === 'Colorless') {
          if (!colors.includes('Colorless') || colors.includes('Multicolor')) return false;
        } else if (!colors.includes(selectedColor)) {
          return false;
        }
      }

      return true;
    });
  }, [cards, searchQuery, selectedRarity, selectedColor]);

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { C: 0, U: 0, R: 0, M: 0, L: 0, T: 0 };
    cards.forEach(c => {
      counts[c.rarity] = (counts[c.rarity] || 0) + 1;
    });
    return counts;
  }, [cards]);

  const hasFilters = searchQuery.trim() !== '' || selectedRarity !== 'ALL' || selectedColor !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRarity('ALL');
    setSelectedColor('ALL');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card_database_${cards.length}_cards.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => toast({ tone: 'error', message: `Couldn’t read “${file.name}”. Try selecting the file again.` });
    reader.onload = evt => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(evt.target?.result ?? ''));
      } catch {
        toast({ tone: 'error', message: `“${file.name}” isn’t valid JSON. Check the file for syntax errors.` });
        return;
      }
      if (!Array.isArray(parsed)) {
        toast({ tone: 'error', message: 'The file must contain a JSON array of card objects.' });
        return;
      }

      const entries = parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
      if (entries.length === 0) {
        toast({ tone: 'error', message: 'No card objects found in the file. Nothing was imported.' });
        return;
      }

      const now = Date.now();
      const imported = entries.map((item, idx) => normalizeImportedCard(item, idx, now));

      onImportCards(imported);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-10 rounded-xl border border-accent-line/60 bg-accent-soft text-accent-fg" aria-hidden>
              <Database className="size-5" />
            </div>
            <div>
              <h2 id={`${id}-title`} className="text-section text-fg-strong">
                Card database
              </h2>
              <p className="text-sm text-fg-muted">The pool every booster is collated from. Edits apply to the next generated box.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileInput} type="file" accept=".json,application/json" onChange={handleImportJson} className="hidden" />
            <Button onClick={onOpenScryfallImport}>
              <CloudDownload aria-hidden className="size-4" />
              Import from Scryfall
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden className="size-4" />
              Import JSON
            </Button>
            <Button onClick={handleExportJson}>
              <Download aria-hidden className="size-4" />
              Export JSON
            </Button>
            <Button variant="primary" onClick={onCreateCard}>
              <Plus aria-hidden className="size-4" />
              Add card
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
          <div className="rounded-xl border border-line bg-well px-3 py-2">
            <dt className="text-xs text-fg-muted">Total</dt>
            <dd className="text-lg font-bold tabular-nums text-fg-strong">{cards.length}</dd>
          </div>
          {RARITY_ORDER.map(r => (
            <div key={r} className="rounded-xl border border-line bg-well px-3 py-2">
              <dt className={`text-xs ${RARITY[r].text}`}>{r === 'M' ? 'Mythics' : `${RARITY[r].label.replace('Basic ', '')}s`}</dt>
              <dd className={`text-lg font-bold tabular-nums ${RARITY[r].text}`}>{rarityCounts[r] || 0}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="space-y-3 rounded-2xl border border-line bg-panel/60 p-3">
        <div className="relative">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search cards
          </label>
          <Search aria-hidden className="size-4 text-fg-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id={`${id}-search`}
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, rules text, type or artist"
            className="w-full min-h-10 pointer-coarse:min-h-11 rounded-lg border border-line-strong bg-well pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted/80 hover:border-slate-600 focus-visible:border-accent"
          />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
          <div role="group" aria-label="Filter by rarity" className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
            <ToggleChip selected={selectedRarity === 'ALL'} onClick={() => { playClickSound(); setSelectedRarity('ALL'); }}>
              All rarities
            </ToggleChip>
            {RARITY_ORDER.map(r => (
              <ToggleChip key={r} selected={selectedRarity === r} onClick={() => { playClickSound(); setSelectedRarity(r); }}>
                {RARITY[r].label}
              </ToggleChip>
            ))}
          </div>

          <div role="group" aria-label="Filter by color" className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
            <ToggleChip selected={selectedColor === 'ALL'} tone="inverse" onClick={() => { playClickSound(); setSelectedColor('ALL'); }}>
              Any color
            </ToggleChip>
            {MANA_ORDER.map(c => (
              <ToggleChip
                key={c}
                selected={selectedColor === c}
                tone="inverse"
                onClick={() => { playClickSound(); setSelectedColor(c); }}
              >
                <span aria-hidden className={`size-2.5 rounded-full ${MANA[c].swatch}`} />
                {c === 'Multicolor' ? 'Multi' : MANA[c].label}
              </ToggleChip>
            ))}
          </div>
        </div>
      </div>

      <section aria-label="Cards">
        <p className="text-sm text-fg-muted mb-3" aria-live="polite">
          Showing <span className="tabular-nums">{filteredCards.length}</span> of{' '}
          <span className="tabular-nums">{cards.length}</span> cards
        </p>

        {filteredCards.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel/40 px-6 py-12 text-center">
            <SearchX aria-hidden className="size-8 mx-auto text-fg-muted mb-3" />
            <p className="text-base font-semibold text-fg">
              {cards.length === 0 ? 'Your card database is empty.' : 'No cards match these filters.'}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {cards.length === 0
                ? 'Add a card, import a JSON file, or reset to the original set from the header.'
                : 'Try a different search term or clear the filters.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {hasFilters && cards.length > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
              {cards.length === 0 && (
                <Button variant="primary" onClick={onCreateCard}>
                  <Plus aria-hidden className="size-4" />
                  Add card
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ul className="card-grid">
            {filteredCards.map(card => (
              <li key={card.id} className="relative group [content-visibility:auto] [contain-intrinsic-size:auto_18rem]">
                <CardItem card={card} onClick={() => onInspectCard(card)} />
                <div
                  className={
                    'absolute top-2 right-2 z-30 flex gap-1 rounded-xl border border-line-strong bg-panel/95 p-1 shadow-lg ' +
                    'transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100'
                  }
                >
                  <IconButton label={`Edit ${card.name}`} variant="ghost" onClick={() => onEditCard(card)}>
                    <Pencil aria-hidden className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${card.name}`}
                    variant="ghost"
                    className="hover:text-danger"
                    onClick={() => onDeleteCard(card.id)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
