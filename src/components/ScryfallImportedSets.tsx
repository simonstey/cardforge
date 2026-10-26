import React, { useId, useMemo } from 'react';
import type { Card } from '../types/card';
import { listImportedSets } from '../scryfall/merge';
import type { ScryfallSet } from '../scryfall/types';
import { Button } from './ui/Button';

interface ImportedSetsListProps {
  cards: Card[];
  /** The Scryfall set list, for set symbols; null while it loads. */
  sets: ScryfallSet[] | null;
  onRemove: (code: string) => void;
}

/** Every Scryfall set in the database with its card count and a Remove action (spec 6.6 step 6). */
export const ImportedSetsList: React.FC<ImportedSetsListProps> = ({ cards, sets, onRemove }) => {
  const id = useId();
  const imported = useMemo(() => listImportedSets(cards), [cards]);
  if (imported.length === 0) return null;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <h3 id={`${id}-title`} className="text-group uppercase text-fg-soft">
        Imported sets
      </h3>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {imported.map(set => {
          const icon = sets?.find(s => s.code === set.code.toLowerCase())?.icon_svg_uri;
          return (
            <li key={set.code} className="flex items-center gap-3 px-3 py-2">
              {icon ? (
                // Scryfall's set symbols are black; inverted they read on the dark panel.
                <img src={icon} alt="" width={20} height={20} className="size-5 shrink-0 invert opacity-80" />
              ) : (
                <span aria-hidden className="size-5 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{set.name}</span>
                <span className="block text-xs text-fg-muted">
                  {set.code} · {set.count} {set.count === 1 ? 'card' : 'cards'}
                </span>
              </span>
              <Button variant="danger" onClick={() => onRemove(set.code)}>
                Remove<span className="sr-only"> {set.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
