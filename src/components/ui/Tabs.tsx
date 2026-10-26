import React, { useRef } from 'react';
import { cx } from './cx';

export interface TabItem<K extends string> {
  key: K;
  label: string;
}

/** The id of a tab, which names its panel. */
export const tabId = (idPrefix: string, key: string) => `${idPrefix}-tab-${key}`;
/** The id of the panel a tab controls. */
export const tabPanelId = (idPrefix: string, key: string) => `${idPrefix}-panel-${key}`;

interface TabListProps<K extends string> {
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for the tab and panel ids; panels use `tabPanelId` and `aria-labelledby={tabId(…)}`. */
  idPrefix: string;
  tabs: readonly TabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  className?: string;
}

/**
 * ARIA tabs with a roving tabindex: Tab reaches the selected tab only, Left/Right (and Home/End)
 * move between tabs and select them. Styled as the header's segmented tray.
 */
export function TabList<K extends string>({ label, idPrefix, tabs, selected, onSelect, className }: TabListProps<K>) {
  const refs = useRef(new Map<K, HTMLButtonElement>());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    const i = tabs.findIndex(t => t.key === selected);
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(tabs[next].key);
    refs.current.get(tabs[next].key)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx('flex gap-1 rounded-xl border border-line bg-well p-1', className)}
    >
      {tabs.map(({ key, label: text }) => {
        const isSelected = key === selected;
        return (
          <button
            key={key}
            ref={el => {
              if (el) refs.current.set(key, el);
              else refs.current.delete(key);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, key)}
            aria-selected={isSelected}
            aria-controls={tabPanelId(idPrefix, key)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(key)}
            className={cx(
              'flex-1 rounded-lg px-3 min-h-9 pointer-coarse:min-h-11 text-sm font-semibold cursor-pointer transition-colors duration-150',
              isSelected ? 'bg-accent-soft text-accent-fg ring-1 ring-accent-line' : 'text-fg-muted hover:text-fg-strong hover:bg-raised'
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
