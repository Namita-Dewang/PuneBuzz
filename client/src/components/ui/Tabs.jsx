import cx from '../../utils/cx';

/**
 * Accessible tab list (WAI-ARIA tabs: arrow keys move between tabs).
 *   items: [{ key, label, count? }], value: active key, onChange(key)
 * Each tab gets id `tab-<key>` and controls `panelId`; render the panel
 * yourself: <div id={panelId} role="tabpanel" aria-labelledby={`tab-${value}`}>.
 */
export default function Tabs({ label, items, value, onChange, panelId = 'tab-panel', className = '' }) {
  function handleKeyDown(e) {
    const i = items.findIndex((t) => t.key === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = items[(next + items.length) % items.length];
    onChange(tab.key);
    document.getElementById(`tab-${tab.key}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx('-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}
    >
      {items.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={cx(
              'relative -mb-px flex items-center gap-2 whitespace-nowrap px-3 pb-3 pt-2 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              selected ? 'text-ink after:bg-accent' : 'text-ink-muted after:bg-transparent hover:text-ink'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums leading-5',
                  selected ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-muted'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
