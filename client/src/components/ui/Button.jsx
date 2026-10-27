import cx from '../../utils/cx';
import { SpinnerIcon } from './Spinner';

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 [&_svg]:size-4 [&_svg]:shrink-0 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55';

const VARIANTS = {
  primary: 'bg-accent text-on-accent shadow-soft hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-subtle hover:bg-sunken',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-on-danger shadow-soft hover:opacity-90',
  success: 'bg-success text-on-accent shadow-soft',
  'danger-outline': 'border border-danger/35 bg-surface text-danger hover:bg-danger-soft',
};

const SIZES = {
  sm: 'h-8 px-3.5 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
};

/**
 * <Button variant="primary|secondary|ghost|danger|danger-outline|success" size="sm|md|lg" loading fullWidth>
 * Renders a <button> by default; pass `as={Link}` (plus `to`) or `as="a"` for links.
 * `loading` shows a spinner and disables the button; keep a visible label
 * (e.g. "Saving…") so the text still says what's happening.
 */
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  type,
  className = '',
  children,
  ...props
}) {
  const isButton = Component === 'button';
  return (
    <Component
      {...(isButton ? { type: type ?? 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || undefined })}
      aria-busy={loading || undefined}
      className={cx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading && <SpinnerIcon size="sm" />}
      {children}
    </Component>
  );
}
