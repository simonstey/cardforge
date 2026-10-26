import React, { useEffect, useMemo, useState } from 'react';
import type { ScryfallSet } from '../scryfall/types';
import { cx } from './ui/cx';

/**
 * Sets whose code or name contains `query`, case-insensitively. An exact code or name comes
 * first, then code prefixes, then the rest; ties keep the list's order (newest first).
 */
export function matchSets(sets: ScryfallSet[], query: string): ScryfallSet[] {
  const q = query.trim().toLowerCase();
  if (!q) return sets;
  const rank = (s: ScryfallSet) => (s.code === q || s.name.toLowerCase() === q ? 0 : s.code.startsWith(q) ? 1 : 2);
  return sets.filter(s => s.code.includes(q) || s.name.toLowerCase().includes(q)).sort((a, b) => rank(a) - rank(b));
}

const FIELD =
  'w-full rounded-lg border border-line-strong bg-well px-3 min-h-10 pointer-coarse:min-h-11 text-sm text-fg ' +
  'placeholder:text-fg-muted/70 hover:border-slate-600 focus-visible:border-accent aria-invalid:border-danger ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

interface SetComboboxProps {
  /** id of the input; the parent's <label> points at it. */
  id: string;
  /** id of that label, which also names the listbox. */
  labelId: string;
  /** The sets to offer; null while the list is loading. */
  sets: ScryfallSet[] | null;
  value: string;
  /** Free typing: any text is allowed, including codes that aren't listed. */
  onChange: (value: string) => void;
  onPick: (set: ScryfallSet) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Set picker following the ARIA combobox pattern: the input keeps focus while the arrow keys
 * move through a listbox of matching sets. Enter picks the highlighted set; with nothing
 * highlighted it submits the surrounding form.
 */
export const SetCombobox = React.forwardRef<HTMLInputElement, SetComboboxProps>(
  ({ id, labelId, sets, value, onChange, onPick, disabled, invalid, describedBy }, ref) => {
    const listId = `${id}-list`;
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const matches = useMemo(() => (sets ? matchSets(sets, value) : []), [sets, value]);
    const expanded = open && !disabled && matches.length > 0;
    const activeIndex = expanded && active < matches.length ? active : -1;
    const optionId = (set: ScryfallSet) => `${listId}-${set.code}`;
    const activeSet = activeIndex >= 0 ? matches[activeIndex] : undefined;

    // Keep the highlighted option in view while the arrow keys move through a long list.
    useEffect(() => {
      if (activeSet) document.getElementById(optionId(activeSet))?.scrollIntoView({ block: 'nearest' });
    }, [activeSet]);

    const pick = (set: ScryfallSet) => {
      onPick(set);
      setOpen(false);
      setActive(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const last = matches.length - 1;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!expanded) {
            setOpen(true);
            setActive(e.altKey ? -1 : 0);
          } else {
            setActive(Math.min(activeIndex + 1, last));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!expanded) {
            setOpen(true);
            setActive(last);
          } else {
            setActive(Math.max(activeIndex - 1, 0));
          }
          break;
        case 'Enter':
          if (activeSet) {
            e.preventDefault();
            pick(activeSet);
          }
          break;
        case 'Escape':
          // Close the list only; the dialog closes on the next Escape.
          if (expanded) {
            e.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          break;
      }
    };

    return (
      <>
        <input
          ref={ref}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={activeSet ? optionId(activeSet) : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={value}
          placeholder="e.g. Kamigawa: Neon Dynasty or NEO"
          onChange={e => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
          className={FIELD}
        />
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          hidden={!expanded}
          // Keep focus in the input when an option is clicked.
          onMouseDown={e => e.preventDefault()}
          className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-line-strong bg-well p-1"
        >
          {expanded &&
            matches.map((set, i) => (
              <li
                key={set.code}
                id={optionId(set)}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => pick(set)}
                className={cx(
                  'flex items-center gap-3 rounded-md px-2 py-1.5 min-h-10 pointer-coarse:min-h-11 cursor-pointer text-sm transition-colors duration-150',
                  i === activeIndex ? 'bg-accent-soft text-accent-fg' : 'text-fg hover:bg-raised'
                )}
              >
                {set.icon_svg_uri ? (
                  // Scryfall's set symbols are black; inverted they read on the dark list.
                  <img src={set.icon_svg_uri} alt="" width={20} height={20} loading="lazy" className="size-5 shrink-0 invert opacity-80" />
                ) : (
                  <span aria-hidden className="size-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">{set.name}</span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {set.code.toUpperCase()}
                  {set.released_at && ` · ${set.released_at.slice(0, 4)}`}
                </span>
              </li>
            ))}
        </ul>
      </>
    );
  }
);
SetCombobox.displayName = 'SetCombobox';
