import React, { useState, useMemo } from 'react';
import { Card, Rarity, CardColor } from '../types/card';
import { CardItem } from './CardItem';
import { determineColors, getRarityLabel, getColorBadge } from '../utils/cardHelpers';
import { playClickSound } from '../utils/audioFeedback';
import { Search, Plus, Download, Upload, Filter, Trash2, Edit3, Database, Sparkles, Check, X } from 'lucide-react';

interface CardDatabaseProps {
  cards: Card[];
  onAddCard: (card: Card) => void;
  onUpdateCard: (card: Card) => void;
  onDeleteCard: (id: string) => void;
  onInspectCard: (card: Card) => void;
  onImportCards: (cards: Card[]) => void;
}

export const CardDatabase: React.FC<CardDatabaseProps> = ({
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onInspectCard,
  onImportCards,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  // Form State for Adding / Editing Card
  const [formData, setFormData] = useState<{
    name: string;
    cost: string;
    type: string;
    rarity: Rarity;
    text: string;
    flavorText: string;
    powerToughness: string;
    artist: string;
  }>({
    name: '',
    cost: '',
    type: 'Creature',
    rarity: 'C',
    text: '',
    flavorText: '',
    powerToughness: '',
    artist: '',
  });

  const handleOpenAdd = () => {
    setEditingCard(null);
    setFormData({
      name: '',
      cost: '',
      type: 'Creature',
      rarity: 'C',
      text: '',
      flavorText: '',
      powerToughness: '',
      artist: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (card: Card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      cost: card.cost || '',
      type: card.type,
      rarity: card.rarity,
      text: card.text || '',
      flavorText: card.flavorText || '',
      powerToughness: card.powerToughness || '',
      artist: card.artist || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.type.trim()) {
      alert('Card name and type are required.');
      return;
    }

    const colors = determineColors(formData.cost, formData.type);

    if (editingCard) {
      onUpdateCard({
        ...editingCard,
        name: formData.name.trim(),
        cost: formData.cost.trim(),
        type: formData.type.trim(),
        rarity: formData.rarity,
        text: formData.text.trim(),
        flavorText: formData.flavorText.trim(),
        powerToughness: formData.powerToughness.trim(),
        artist: formData.artist.trim(),
        colors,
      });
    } else {
      const newCard: Card = {
        id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: formData.name.trim(),
        cost: formData.cost.trim(),
        type: formData.type.trim(),
        rarity: formData.rarity,
        text: formData.text.trim(),
        flavorText: formData.flavorText.trim(),
        powerToughness: formData.powerToughness.trim(),
        artist: formData.artist.trim(),
        colors,
      };
      onAddCard(newCard);
    }
    setIsAddModalOpen(false);
  };

  // Filter cards
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Search text
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(query);
        const matchesText = (card.text || '').toLowerCase().includes(query);
        const matchesType = card.type.toLowerCase().includes(query);
        const matchesArtist = (card.artist || '').toLowerCase().includes(query);
        if (!matchesName && !matchesText && !matchesType && !matchesArtist) return false;
      }

      // Rarity
      if (selectedRarity !== 'ALL' && card.rarity !== selectedRarity) {
        return false;
      }

      // Color
      if (selectedColor !== 'ALL') {
        const colors = card.colors || ['Colorless'];
        if (selectedColor === 'Colorless') {
          if (!colors.includes('Colorless') || colors.includes('Multicolor')) return false;
        } else if (selectedColor === 'Multicolor') {
          if (!colors.includes('Multicolor')) return false;
        } else {
          if (!colors.includes(selectedColor as CardColor)) return false;
        }
      }

      return true;
    });
  }, [cards, searchQuery, selectedRarity, selectedColor]);

  // Export database as JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cards, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `card_database_${cards.length}_cards.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          alert('Imported JSON must be an array of card objects.');
          return;
        }
        const imported = parsed.map((item, idx) => {
          const colors = determineColors(item.cost, item.type);
          return {
            id: item.id || `imported-${Date.now()}-${idx}`,
            name: item.name || 'Untitled Card',
            cost: item.cost || '',
            type: item.type || 'Card',
            text: item.text || '',
            flavorText: item.flavorText || '',
            powerToughness: item.powerToughness || '',
            rarity: (item.rarity as Rarity) || 'C',
            artist: item.artist || '',
            source: item.source || 'Custom Import',
            colors,
          } as Card;
        });

        onImportCards(imported);
        alert(`Successfully imported ${imported.length} cards!`);
      } catch (err) {
        alert('Failed to parse JSON file. Please verify file syntax.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Rarity breakdown counts
  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { C: 0, U: 0, R: 0, M: 0, L: 0, T: 0 };
    cards.forEach(c => {
      counts[c.rarity] = (counts[c.rarity] || 0) + 1;
    });
    return counts;
  }, [cards]);

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Custom Card Set Database</h2>
              <p className="text-xs text-slate-400">
                Browse, search, edit, or import custom cards used for booster collation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Import JSON
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Custom Card
            </button>
          </div>
        </div>

        {/* Breakdown pill badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400">Total Cards</span>
            <div className="text-base font-bold text-slate-200 font-mono">{cards.length}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-300">Commons</span>
            <div className="text-base font-bold text-slate-300 font-mono">{rarityCounts.C || 0}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-sky-400">Uncommons</span>
            <div className="text-base font-bold text-sky-400 font-mono">{rarityCounts.U || 0}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-amber-400">Rares</span>
            <div className="text-base font-bold text-amber-400 font-mono">{rarityCounts.R || 0}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-orange-400 flex items-center justify-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Mythics
            </span>
            <div className="text-base font-bold text-orange-400 font-mono">{rarityCounts.M || 0}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-emerald-400">Lands</span>
            <div className="text-base font-bold text-emerald-400 font-mono">{rarityCounts.L || 0}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] text-purple-400">Tokens</span>
            <div className="text-base font-bold text-purple-400 font-mono">{rarityCounts.T || 0}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, oracle text, type, artist..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Rarity filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {[
            { id: 'ALL', label: 'All Rarities' },
            { id: 'C', label: 'Commons' },
            { id: 'U', label: 'Uncommons' },
            { id: 'R', label: 'Rares' },
            { id: 'M', label: 'Mythics' },
            { id: 'L', label: 'Lands' },
            { id: 'T', label: 'Tokens' },
          ].map(r => (
            <button
              key={r.id}
              onClick={() => {
                playClickSound();
                setSelectedRarity(r.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                selectedRarity === r.id
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Color filter */}
        <div className="flex items-center gap-1">
          {['ALL', 'W', 'U', 'B', 'R', 'G', 'Multicolor', 'Colorless'].map(col => {
            const isSelected = selectedColor === col;
            return (
              <button
                key={col}
                onClick={() => {
                  playClickSound();
                  setSelectedColor(col);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-100 text-slate-950 border-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {col === 'ALL' ? 'Any Color' : col === 'Multicolor' ? 'Multi' : col}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span>Showing {filteredCards.length} of {cards.length} cards</span>
        </div>

        {filteredCards.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
            <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm">No cards match the current search filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredCards.map(card => (
              <div key={card.id} className="relative group">
                <CardItem card={card} onClick={() => onInspectCard(card)} />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 rounded-lg p-1 border border-slate-700">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenEdit(card);
                    }}
                    title="Edit card"
                    className="p-1 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete "${card.name}"?`)) {
                        onDeleteCard(card.id);
                      }
                    }}
                    title="Delete card"
                    className="p-1 text-slate-300 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Card Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCard ? 'Edit Card' : 'Add New Custom Card'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Card Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    placeholder="e.g. Luke Skywalker"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mana Cost</label>
                  <input
                    type="text"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    placeholder="e.g. 2WU or 1BR"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Type Line *</label>
                  <input
                    type="text"
                    required
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    placeholder="e.g. Legendary Creature - Jedi"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rarity</label>
                  <select
                    value={formData.rarity}
                    onChange={e => setFormData({ ...formData, rarity: e.target.value as Rarity })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="C">Common (C)</option>
                    <option value="U">Uncommon (U)</option>
                    <option value="R">Rare (R)</option>
                    <option value="M">Mythic Rare (M)</option>
                    <option value="L">Basic Land (L)</option>
                    <option value="T">Token (T)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Oracle / Rules Text</label>
                <textarea
                  rows={3}
                  value={formData.text}
                  onChange={e => setFormData({ ...formData, text: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  placeholder="Card abilities and rules text..."
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Flavor Text</label>
                <input
                  type="text"
                  value={formData.flavorText}
                  onChange={e => setFormData({ ...formData, flavorText: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white italic"
                  placeholder="Italicized lore or quote..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Power / Toughness</label>
                  <input
                    type="text"
                    value={formData.powerToughness}
                    onChange={e => setFormData({ ...formData, powerToughness: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    placeholder="e.g. 4/4 or 3 (loyalty)"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Artist Credit</label>
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={e => setFormData({ ...formData, artist: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    placeholder="e.g. Darren Tan"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/50"
                >
                  {editingCard ? 'Save Changes' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
