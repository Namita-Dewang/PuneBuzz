import cx from '../../utils/cx';

/**
 * Label + control + hint/error, wired for screen readers. The control gets
 * id / aria-invalid / aria-describedby through a render prop:
 *   <Field name="title" label="Title" error={errors.title}>
 *     {(p) => <Input {...p} invalid={!!errors.title} value=… />}
 *   </Field>
 */
export default function Field({ name, label, hint, error, optional, size = 'md', className = '', children }) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={name}
          className={cx('block font-medium text-ink', size === 'sm' ? 'mb-1 text-xs text-ink-muted' : 'mb-1.5 text-sm')}
        >
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-subtle">optional</span>}
        </label>
      )}
      {children({ id: name, name, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
