import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cx } from './cx';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** Single-slot toast region: a new message replaces the current one. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const nextId = useRef(1);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    window.clearTimeout(timer.current);
    const id = nextId.current++;
    setToast({ ...options, id });
    timer.current = window.setTimeout(() => setToast(t => (t?.id === id ? null : t)), options.duration ?? 6000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const Icon = toast?.tone === 'error' ? CircleAlert : CircleCheck;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border bg-raised py-2 pl-4 pr-2 text-sm text-fg shadow-xl shadow-black/50',
              'transition-[opacity,translate] duration-200 ease-out-expo starting:opacity-0 starting:translate-y-2 motion-reduce:starting:translate-y-0',
              toast.tone === 'error' ? 'border-rose-700' : 'border-line-strong'
            )}
          >
            <Icon
              aria-hidden
              className={cx('size-4 shrink-0', toast.tone === 'error' ? 'text-danger' : 'text-success')}
            />
            <span className="min-w-0 py-1">{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
                className="shrink-0 rounded-lg px-3 min-h-8 pointer-coarse:min-h-11 text-sm font-semibold text-accent-fg hover:bg-raised-hover cursor-pointer"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center size-8 pointer-coarse:size-11 rounded-lg text-fg-muted hover:text-fg-strong hover:bg-raised-hover cursor-pointer"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
};
