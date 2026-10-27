import cx from '../../utils/cx';

const SIZES = { sm: 'size-4 border-2', md: 'size-6 border-2', lg: 'size-8 border-[3px]' };

// Inline spinner, e.g. inside a Button. Decorative: pair it with visible text.
export function SpinnerIcon({ size = 'sm', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent opacity-80', SIZES[size], className)}
    />
  );
}

// Centered page-level loading indicator with a screen-reader label.
export default function Spinner({ label = 'Loading', className = '' }) {
  return (
    <div role="status" className={cx('flex items-center justify-center py-16 text-accent', className)}>
      <SpinnerIcon size="md" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
