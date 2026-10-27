import cx from '../utils/cx';
import { CATEGORY_ICONS, CATEGORY_LABELS, categoryTheme } from '../utils/constants';

// Category tag in the category's own colour.
//   variant="label": icon + small caps, no background (headers, lists)
//   variant="badge": on the category's soft fill (plain surfaces)
//   variant="pill":  on a near-white pill (on top of a coloured card band)
export default function CategoryLabel({ category, variant = 'label', className = '' }) {
  const theme = categoryTheme(category);
  const Icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.all;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase leading-none tracking-[0.12em]',
        theme.text,
        variant === 'badge' && cx('rounded-full px-2.5 py-1.5', theme.badge),
        variant === 'pill' && 'rounded-full bg-surface/90 px-2.5 py-1.5 shadow-soft backdrop-blur-sm',
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}
