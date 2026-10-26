import React, { useId, useMemo } from 'react';
import { Info } from 'lucide-react';
import type { BulkSetOption } from '../scryfall/bulkSets';
import { cx } from './ui/cx';
import { matchSets } from './ScryfallSetCombobox';

const LABEL = 'block text-sm font-medium text-fg-soft mb-1.5';
const FIELD =
  'w-full rounded-lg border border-line-strong bg-well px-3 min-h-10 pointer-coarse:min-h-11 text-sm text-fg ' +
  'placeholder:text-fg-muted/70 hover:border-slate-600 focus-visible:border-accent';
const SET_ROW =
  'flex items-start gap-3 px-3 py-2 min-h-11 cursor-pointer transition-colors duration-150 hover:bg-raised/60 ' +
  'has-disabled:opacity-50 has-disabled:cursor-not-allowed';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

interface BulkSetPickerProps {
  sets: BulkSetOption[];
  selected: ReadonlySet<string>;
  onToggle: (code: string, on: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Named in the hint: "851 sets in default-cards.jsonl.gz". */
  fileName: string;
  /** Lines of the file that weren't card JSON. */
  malformed: number;
  /** Shows "Pick at least one set." */
  missing: boolean;
}

/**
 * The sets a scanned bulk file offers, as a filterable checkbox list (spec 6.12). The ref is the
 * filter field. Disable it with an enclosing <fieldset disabled>.
 */
export const BulkSetPicker = React.forwardRef<HTMLInputElement, BulkSetPickerProps>(
  ({ sets, selected, onToggle, query, onQueryChange, fileName, malformed, missing }, ref) => {
    const id = useId();
    const shown = useMemo(() => matchSets(sets, query), [sets, query]);
    // Counts listed sets only: a selected set can fold into its parent once the set list arrives.
    const chosen = sets.filter(s => selected.has(s.code)).length;
    const count =
      shown.length === sets.length ? `${plural(sets.length, 'set')} in ${fileName}` : `Showing ${shown.length} of ${sets.length} sets`;

    return (
      <fieldset className="min-w-0">
        <legend className={LABEL}>Sets</legend>
        <label htmlFor={`${id}-filter`} className="sr-only">
          Filter sets
        </label>
        <input
          ref={ref}
          id={`${id}-filter`}
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Filter by name or code"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-hint`}
          className={FIELD}
        />
        <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-line rounded-xl border border-line">
          {shown.map(s => {
            const checked = selected.has(s.code);
            return (
              <li key={s.code}>
                <label className={cx(SET_ROW, checked && 'bg-accent-soft/50 hover:bg-accent-soft/70')}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onToggle(s.code, e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">{s.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {s.code.toUpperCase()} · {plural(s.count, 'card')}
                      {s.tokenCount > 0 && ` · ${plural(s.tokenCount, 'token')}`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted">No set in this file matches “{query.trim()}”.</li>}
        </ul>
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-muted">
          {count} · {chosen} selected
        </p>
        {missing && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            Pick at least one set.
          </p>
        )}
        {malformed > 0 && (
          <p className="mt-1.5 flex items-start gap-2 text-xs text-fg-muted">
            <Info aria-hidden className="size-4 shrink-0" />
            {malformed === 1 ? 'Skipped 1 line that wasn’t card data.' : `Skipped ${malformed} lines that weren’t card data.`}
          </p>
        )}
      </fieldset>
    );
  }
);
BulkSetPicker.displayName = 'BulkSetPicker';
