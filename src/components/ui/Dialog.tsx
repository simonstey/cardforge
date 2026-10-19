import React, { useEffect, useRef } from 'react';
import { cx } from './cx';

interface DialogProps {
  /** id of the element that names the dialog (usually its heading). */
  labelledBy: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal built on the native <dialog> element: showModal() gives a focus trap,
 * inert background and Escape handling. Mount it to open, unmount it to close;
 * focus returns to whatever was focused before it opened.
 */
export const Dialog: React.FC<DialogProps> = ({ labelledBy, onClose, className, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;

    dialog.showModal();
    root.style.overflow = 'hidden';

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) dialog.close();
      root.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={e => {
        // A click on the <dialog> element itself (not its content) is a backdrop click.
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      className={cx(
        'm-auto w-[min(100%-2rem,32rem)] max-h-[min(100dvh-2rem,56rem)] overflow-hidden p-0',
        'rounded-3xl border border-line-strong bg-panel text-fg shadow-2xl shadow-black/60',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:max-h-[94dvh]',
        'opacity-100 translate-y-0 transition-[opacity,translate] duration-200 ease-out-expo starting:opacity-0 starting:translate-y-3',
        'motion-reduce:translate-y-0 motion-reduce:starting:translate-y-0',
        className
      )}
    >
      {children}
    </dialog>
  );
};
