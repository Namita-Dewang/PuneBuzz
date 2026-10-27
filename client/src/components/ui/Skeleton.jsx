import cx from '../../utils/cx';

// Placeholder block while content loads. Size it with className, e.g.
// <Skeleton className="h-4 w-1/2" />. Decorative: wrap groups in an
// element with aria-busy / aria-label for screen readers.
export default function Skeleton({ className = '', rounded = 'rounded-lg', style }) {
  return <div aria-hidden="true" style={style} className={cx('animate-pulse bg-sunken', rounded, className)} />;
}
