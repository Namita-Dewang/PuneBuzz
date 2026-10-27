import cx from '../../utils/cx';

const TONES = {
  neutral: 'bg-sunken text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  closed: 'bg-closed-soft text-closed',
  danger: 'bg-danger-soft text-danger',
};

/**
 * Small status label. tone: neutral | accent | success | warning | closed | danger.
 * `dot` adds a leading dot in the current text colour.
 */
export default function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5',
        TONES[tone],
        className
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
