import { controlClass } from './Input';

// Native <select> (keyboard and screen-reader support for free) restyled
// with the shared control look and a custom chevron. Pass <option>s as children.
export default function Select({ invalid = false, className = '', children, ...props }) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || props['aria-invalid'] || undefined}
        className={controlClass(invalid, `cursor-pointer appearance-none pr-10 ${className}`)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
      >
        <path d="m5.5 8 4.5 4.5L14.5 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
