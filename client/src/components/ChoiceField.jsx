import cx from '../utils/cx';

// Selectable cards backed by radio buttons, e.g. the account type on sign-up
// or an event's visibility. options: [{ value, label, description, disabled? }]
export default function ChoiceField({ name, label, options, value, onChange, error, columns = 1 }) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-ink">{label}</legend>
      <div className={cx('grid gap-2.5', columns === 2 && 'sm:grid-cols-2')}>
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cx(
                'flex gap-3 rounded-xl border p-4 text-sm transition',
                checked ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line-strong bg-surface',
                option.disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-ink-subtle'
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span>
                <span className="block font-semibold text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </fieldset>
  );
}
