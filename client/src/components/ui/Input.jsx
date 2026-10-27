import cx from '../../utils/cx';

// Shared look for every text-like control (inputs, selects, textareas).
export function controlClass(invalid, className = '') {
  return cx(
    'block w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-ink shadow-soft outline-none transition',
    'placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-60',
    invalid
      ? 'border-danger focus:ring-4 focus:ring-danger/15'
      : 'border-line-strong hover:border-ink-subtle focus:border-accent focus:ring-4 focus:ring-accent/15',
    className
  );
}

/**
 * Text input. `invalid` turns it red; `leading` puts an icon inside on the left.
 * All other props (id, value, onChange, aria-*) go to the <input>.
 */
export default function Input({ invalid = false, leading, className = '', type = 'text', ...props }) {
  const input = (
    <input
      type={type}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={controlClass(invalid, cx(leading && 'pl-10', className))}
      {...props}
    />
  );
  if (!leading) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-subtle">{leading}</span>
      {input}
    </div>
  );
}

export function Textarea({ invalid = false, className = '', rows = 5, ...props }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={controlClass(invalid, cx('min-h-28 resize-y leading-relaxed', className))}
      {...props}
    />
  );
}
