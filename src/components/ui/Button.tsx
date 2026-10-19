import React from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'foil';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-raised text-fg border border-line-strong hover:bg-raised-hover hover:text-fg-strong',
  ghost: 'text-fg-muted hover:text-fg-strong hover:bg-raised',
  danger: 'text-danger border border-transparent hover:bg-danger-soft hover:border-rose-800',
  foil: 'bg-foil text-foil-ink hover:bg-foil-hover',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-8 px-3 text-control gap-1.5 pointer-coarse:min-h-11',
  md: 'min-h-10 px-4 text-sm gap-2 pointer-coarse:min-h-11',
};

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold whitespace-nowrap cursor-pointer select-none ' +
  'transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px motion-reduce:active:translate-y-0 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', className, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest} />
  )
);
Button.displayName = 'Button';

const ICON_SIZES: Record<Size, string> = {
  sm: 'size-8 pointer-coarse:size-11',
  md: 'size-10 pointer-coarse:size-11',
};

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  variant?: Variant;
  size?: Size;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'secondary', size = 'sm', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(BASE, VARIANTS[variant], ICON_SIZES[size], 'px-0', className)}
      {...rest}
    />
  )
);
IconButton.displayName = 'IconButton';

type ChipTone = 'accent' | 'mythic' | 'inverse';

const CHIP_SELECTED: Record<ChipTone, string> = {
  accent: 'bg-accent-soft text-accent-fg border-accent-line',
  mythic: 'bg-rarity-m-soft text-rarity-m border-rarity-m-line',
  inverse: 'bg-fg text-well border-fg',
};

export interface ToggleChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  tone?: ChipTone;
}

/** A pressable option in a single- or multi-select group. Exposes state via aria-pressed. */
export const ToggleChip: React.FC<ToggleChipProps> = ({ selected, tone = 'accent', className, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-pressed={selected}
    className={cx(
      'inline-flex shrink-0 items-center justify-center gap-1.5 min-h-8 px-3 rounded-lg border text-control font-semibold whitespace-nowrap cursor-pointer',
      'transition-colors duration-150 pointer-coarse:min-h-11',
      selected ? CHIP_SELECTED[tone] : 'bg-well text-fg-muted border-line hover:border-line-strong hover:text-fg',
      className
    )}
    {...rest}
  />
);
