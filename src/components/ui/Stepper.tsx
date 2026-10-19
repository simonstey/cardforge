import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cx } from './cx';

interface StepperProps {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessible name prefix for the -/+ buttons, e.g. "commons". */
  noun: string;
  className?: string;
}

const STEP_BUTTON =
  'grid place-items-center size-8 pointer-coarse:size-11 rounded-lg text-fg-soft hover:bg-raised-hover hover:text-fg-strong ' +
  'disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors duration-150';

/** Number field with -/+ buttons. Typing is free-form; the value is clamped when the field loses focus. */
export const Stepper: React.FC<StepperProps> = ({ id, value, min, max, onChange, noun, className }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = parseInt(draft, 10);
    const next = Number.isFinite(n) ? clamp(n) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={cx('inline-flex items-center rounded-xl border border-line-strong bg-well p-0.5', className)}>
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={`Fewer ${noun}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus aria-hidden className="size-3.5" />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(clamp(value + 1));
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(clamp(value - 1));
          }
        }}
        aria-describedby={`${id}-range`}
        className="w-10 self-stretch bg-transparent text-center text-sm font-bold tabular-nums text-fg-strong rounded-md"
      />
      <span id={`${id}-range`} className="sr-only">
        {min} to {max}
      </span>
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={`More ${noun}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden className="size-3.5" />
      </button>
    </div>
  );
};
