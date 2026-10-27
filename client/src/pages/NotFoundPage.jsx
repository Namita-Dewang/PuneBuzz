import { Link } from 'react-router';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl py-24 text-center sm:py-32">
      <p className="font-display text-[5rem] font-medium italic leading-none text-accent">404</p>
      <h1 className="mt-6 font-display text-title font-medium text-ink">This page went home early</h1>
      <p className="mx-auto mt-3 max-w-prose text-ink-muted">The link may be old, or the page never existed. There's plenty else on tonight.</p>
      <Button as={Link} to="/" variant="secondary" className="mt-8">
        ← Back to events
      </Button>
    </section>
  );
}
