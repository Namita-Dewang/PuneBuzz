import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import cx from '../../utils/cx';

const ToastContext = createContext(null);

const DURATION_MS = 4000;

const TONES = {
  success: { box: 'border-line bg-surface text-ink', icon: 'bg-success-soft text-success', path: 'm8.5 12.5 2.5 2.5 5-5.5' },
  error: { box: 'border-danger/30 bg-surface text-ink', icon: 'bg-danger-soft text-danger', path: 'M12 8v4.5m0 3h.01' },
  info: { box: 'border-line bg-surface text-ink', icon: 'bg-accent-soft text-accent', path: 'M12 11v5m0-8h.01' },
};

// One toast at a time; a new one replaces the current. Usage:
//   const toast = useToast(); toast.show('Saved', 'success' | 'error' | 'info', { duration });
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => setToast(null), []);

  // options.duration (ms) shortens or lengthens this one toast.
  const show = useCallback((message, tone = 'info', { duration = DURATION_MS } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const style = toast && TONES[toast.tone];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live region always exists so screen readers announce new toasts */}
      {/* Sits above the fixed booking bar that event pages show on small screens. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 lg:bottom-6">
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border py-2.5 pl-2.5 pr-3 text-sm shadow-pop',
              style.box
            )}
          >
            <span className={cx('grid size-7 shrink-0 place-items-center rounded-full', style.icon)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
                <path d={style.path} />
              </svg>
            </span>
            <span className="font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="ml-1 grid size-6 place-items-center rounded-full text-ink-subtle transition hover:bg-sunken hover:text-ink"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-3.5">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
