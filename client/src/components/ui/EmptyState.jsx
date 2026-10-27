import cx from '../../utils/cx';

const ICONS = {
  // A soft "nothing here yet" mark: an empty ticket.
  ticket: (
    <path
      d="M5 9.5A1.5 1.5 0 0 1 6.5 8h19A1.5 1.5 0 0 1 27 9.5v3a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 20.5v-3a2.5 2.5 0 0 0 0-5v-3ZM19 8v14"
    />
  ),
  search: <path d="M14.5 22a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20 20l6 6" />,
  alert: <path d="M16 11v6m0 4h.01M14.3 5.9 4.6 22.3A2 2 0 0 0 6.3 25.3h19.4a2 2 0 0 0 1.7-3L17.7 5.9a2 2 0 0 0-3.4 0Z" />,
};

/**
 * Friendly placeholder for "nothing here" and error states.
 * icon: ticket | search | alert (or omit); action: usually a Button.
 */
export default function EmptyState({ icon = 'ticket', title, message, action, className = '' }) {
  return (
    <div className={cx('rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-7"
          >
            {ICONS[icon]}
          </svg>
        </div>
      )}
      <h2 className="font-display text-heading font-medium text-ink">{title}</h2>
      {message && <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-muted">{message}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
