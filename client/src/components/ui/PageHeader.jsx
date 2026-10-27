import cx from '../../utils/cx';

// Shared typographic rhythm, so every page and section spaces things the same:
//   eyebrow → 12px → title → 12px → description / meta → 40px → content
// and actions align to the title block's baseline on wider screens.

export function Eyebrow({ children, className = '' }) {
  return <p className={cx('text-xs font-semibold uppercase tracking-[0.18em] text-accent', className)}>{children}</p>;
}

export default function PageHeader({ eyebrow, title, description, meta, actions, size = 'title', className = '' }) {
  return (
    <header className={cx('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-3 flex flex-wrap items-center gap-3">{eyebrow}</div>}
        <h1 className={cx('font-display font-medium text-ink', size === 'display' ? 'text-display' : 'text-title')}>{title}</h1>
        {description && <p className="mt-3 max-w-prose text-[17px] leading-relaxed text-ink-muted">{description}</p>}
        {meta && <div className="mt-3 text-[15px] text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// Section heading inside a page: Fraunces title, optional one-line note and action.
export function SectionHeader({ title, description, actions, as: Heading = 'h2', className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        <Heading className="font-display text-heading font-medium text-ink">{title}</Heading>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
