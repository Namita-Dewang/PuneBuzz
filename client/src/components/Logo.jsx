// PuneBuzz mark: a map pin (events around Pune) sending out "buzz" waves.
// Keep public/favicon.svg in sync if you change the drawing.
export function LogoMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path
        d="M13 6.5a7.5 7.5 0 0 1 7.5 7.5c0 5.5-7.5 12-7.5 12s-7.5-6.5-7.5-12A7.5 7.5 0 0 1 13 6.5z"
        className="fill-on-accent"
      />
      <circle cx="13" cy="14" r="2.75" className="fill-accent" />
      <path
        d="M18.74 5.81A10 10 0 0 1 22.66 11.41M21.68 3.66A13.5 13.5 0 0 1 26.04 10.51"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="stroke-on-accent"
      />
    </svg>
  );
}

// "Pune Buzz" wordmark in Fraunces, with "Buzz" in the accent colour.
export function Wordmark({ className = 'text-[1.3rem]' }) {
  return (
    <span className={`font-display font-semibold leading-none tracking-tight text-ink ${className}`}>
      Pune <span className="italic text-accent">Buzz</span>
    </span>
  );
}

// Mark + wordmark.
export default function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <Wordmark />
    </span>
  );
}
