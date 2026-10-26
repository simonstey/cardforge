import React, { useId, useState } from 'react';
import { Card, Rarity } from '../types/card';
import { editedColors, colorPips, MANA, RARITY, RARITY_ORDER } from '../utils/cardHelpers';
import { markUserModified } from '../scryfall/merge';
import { Dialog } from './ui/Dialog';
import { Button, IconButton } from './ui/Button';
import { X } from 'lucide-react';

interface CardEditorDialogProps {
  /** Card to edit, or null to create a new one. */
  card: Card | null;
  onCancel: () => void;
  onSave: (card: Card, isNew: boolean) => void;
}

interface FormState {
  name: string;
  cost: string;
  type: string;
  rarity: Rarity;
  text: string;
  flavorText: string;
  powerToughness: string;
  artist: string;
}

const FIELD =
  'w-full rounded-lg border border-line-strong bg-well px-3 min-h-10 text-sm text-fg placeholder:text-fg-muted/70 ' +
  'hover:border-slate-600 focus-visible:border-accent aria-invalid:border-danger';
const LABEL = 'block text-sm font-medium text-fg-soft mb-1.5';

export const CardEditorDialog: React.FC<CardEditorDialogProps> = ({ card, onCancel, onSave }) => {
  const id = useId();
  const isNew = card === null;
  const [form, setForm] = useState<FormState>({
    name: card?.name ?? '',
    cost: card?.cost ?? '',
    type: card?.type ?? 'Creature',
    rarity: card?.rarity ?? 'C',
    text: card?.text ?? '',
    flavorText: card?.flavorText ?? '',
    powerToughness: card?.powerToughness ?? '',
    artist: card?.artist ?? '',
  });
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));

  const nameMissing = !form.name.trim();
  const typeMissing = !form.type.trim();
  // From the cost, unless it is unchanged: a cost-less coloured card (a token) keeps its colours.
  const colors = editedColors(card, form.cost, form.type);
  const pips = colorPips({ colors } as Card);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameMissing || typeMissing) {
      setShowErrors(true);
      document.getElementById(nameMissing ? `${id}-name` : `${id}-type`)?.focus();
      return;
    }
    const fields = {
      name: form.name.trim(),
      cost: form.cost.trim(),
      type: form.type.trim(),
      rarity: form.rarity,
      text: form.text.trim(),
      flavorText: form.flavorText.trim(),
      powerToughness: form.powerToughness.trim(),
      artist: form.artist.trim(),
      colors,
    };
    if (card) {
      onSave(markUserModified({ ...card, ...fields }), false);
    } else {
      onSave({ id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, ...fields }, true);
    }
  };

  return (
    <Dialog labelledBy={`${id}-title`} onClose={onCancel} className="sm:w-[min(100%-2rem,36rem)]">
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 id={`${id}-title`} className="text-section text-fg-strong">
            {isNew ? 'Add custom card' : `Edit “${card.name}”`}
          </h2>
          <IconButton label="Close" variant="ghost" onClick={onCancel}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-name`} className={LABEL}>
                Card name <span className="text-danger" aria-hidden>*</span>
              </label>
              <input
                id={`${id}-name`}
                type="text"
                required
                maxLength={80}
                autoFocus
                value={form.name}
                onChange={e => set('name', e.target.value)}
                aria-invalid={showErrors && nameMissing}
                aria-describedby={showErrors && nameMissing ? `${id}-name-error` : undefined}
                className={FIELD}
                placeholder="e.g. Luke Skywalker"
              />
              {showErrors && nameMissing && (
                <p id={`${id}-name-error`} className="mt-1.5 text-sm text-danger">
                  Give the card a name.
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-cost`} className={LABEL}>
                Mana cost
              </label>
              <input
                id={`${id}-cost`}
                type="text"
                maxLength={20}
                value={form.cost}
                onChange={e => set('cost', e.target.value.toUpperCase())}
                aria-describedby={`${id}-cost-hint`}
                className={`${FIELD} uppercase`}
                placeholder="e.g. 2WU"
              />
              <p id={`${id}-cost-hint`} className="mt-1.5 flex items-center gap-1.5 text-sm text-fg-muted">
                Color:
                {pips.length === 0 ? (
                  <span>Colorless</span>
                ) : (
                  pips.map(c => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span aria-hidden className={`size-2.5 rounded-full ${MANA[c].swatch}`} />
                      {MANA[c].label}
                    </span>
                  ))
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-type`} className={LABEL}>
                Type line <span className="text-danger" aria-hidden>*</span>
              </label>
              <input
                id={`${id}-type`}
                type="text"
                required
                maxLength={80}
                value={form.type}
                onChange={e => set('type', e.target.value)}
                aria-invalid={showErrors && typeMissing}
                aria-describedby={showErrors && typeMissing ? `${id}-type-error` : undefined}
                className={FIELD}
                placeholder="e.g. Legendary Creature - Jedi"
              />
              {showErrors && typeMissing && (
                <p id={`${id}-type-error`} className="mt-1.5 text-sm text-danger">
                  Add a type line, such as “Creature - Jedi”.
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-rarity`} className={LABEL}>
                Rarity
              </label>
              <select
                id={`${id}-rarity`}
                value={form.rarity}
                onChange={e => set('rarity', e.target.value as Rarity)}
                className={FIELD}
              >
                {RARITY_ORDER.map(r => (
                  <option key={r} value={r}>
                    {RARITY[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-text`} className={LABEL}>
              Rules text
            </label>
            <textarea
              id={`${id}-text`}
              rows={4}
              maxLength={1200}
              aria-describedby={`${id}-text-hint`}
              value={form.text}
              onChange={e => set('text', e.target.value)}
              className={`${FIELD} py-2 leading-relaxed`}
              placeholder="Abilities and rules text"
            />
            <p id={`${id}-text-hint`} className="mt-1.5 text-xs text-fg-muted">
              Write symbols in braces: {'{T}'} for tap, {'{2}{R}'} for mana. One ability per line.
            </p>
          </div>

          <div>
            <label htmlFor={`${id}-flavor`} className={LABEL}>
              Flavor text
            </label>
            <input
              id={`${id}-flavor`}
              type="text"
              maxLength={200}
              value={form.flavorText}
              onChange={e => set('flavorText', e.target.value)}
              className={`${FIELD} italic`}
              placeholder="A line of lore or a quote"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-pt`} className={LABEL}>
                Power / toughness
              </label>
              <input
                id={`${id}-pt`}
                type="text"
                maxLength={12}
                value={form.powerToughness}
                onChange={e => set('powerToughness', e.target.value)}
                className={FIELD}
                placeholder="e.g. 4/4"
              />
            </div>
            <div>
              <label htmlFor={`${id}-artist`} className={LABEL}>
                Artist
              </label>
              <input
                id={`${id}-artist`}
                type="text"
                maxLength={80}
                value={form.artist}
                onChange={e => set('artist', e.target.value)}
                className={FIELD}
                placeholder="e.g. Darren Tan"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md">
            {isNew ? 'Add card' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
