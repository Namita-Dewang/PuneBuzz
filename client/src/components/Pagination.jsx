import { Button } from './ui';

export default function Pagination({ page, limit, total, onPageChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-line pt-6">
      <p className="text-sm text-ink-muted">
        Showing <span className="font-medium text-ink">{first}–{last}</span> of{' '}
        <span className="font-medium text-ink">{total}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="hidden px-1 text-sm tabular-nums text-ink-muted sm:inline">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </nav>
  );
}
