import { LogoMark } from './Logo';
import { Card } from './ui';

// Shell for the login and sign-up screens: a centered card with the mark,
// a Fraunces title, and a footer line (e.g. "Already have an account?").
export default function AuthLayout({ header, title, subtitle, footer, children }) {
  return (
    <div className="mx-auto w-full max-w-md py-10 sm:py-16">
      <Card padding="lg">
        <LogoMark className="mb-6 size-10" />
        {header}
        <h1 className="font-display text-title font-medium text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-ink-muted">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </Card>
      {footer && <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>}
    </div>
  );
}
