import React from 'react';
import type { ImportOptions } from '../scryfall/filters';

const OPTION_ROW =
  'flex items-start gap-3 rounded-xl border border-line bg-well/60 p-3 min-h-11 cursor-pointer hover:border-line-strong transition-colors duration-150 ' +
  'has-disabled:opacity-50 has-disabled:cursor-not-allowed';

const OptionRow: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; title: string; hint: string }> = ({
  checked,
  onChange,
  title,
  hint,
}) => (
  <label className={OPTION_ROW}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
    <span>
      <span className="block text-sm font-semibold text-fg">{title}</span>
      <span className="block text-xs text-fg-muted">{hint}</span>
    </span>
  </label>
);

/** The import filters a user can switch (spec 6.4). Disable them with an enclosing <fieldset disabled>. */
export const ImportOptionsFields: React.FC<{ value: ImportOptions; onChange: (next: ImportOptions) => void }> = ({
  value,
  onChange,
}) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <OptionRow
      checked={value.boosterOnly}
      onChange={boosterOnly => onChange({ ...value, boosterOnly })}
      title="Booster cards only"
      hint="Leaves out showcase, borderless and promo printings"
    />
    <OptionRow
      checked={value.includeTokens}
      onChange={includeTokens => onChange({ ...value, includeTokens })}
      title="Include tokens"
      hint="Also imports the set’s tokens"
    />
  </div>
);
