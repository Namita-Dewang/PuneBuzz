// Loading placeholders shaped like the real page they stand in for, so the
// layout doesn't jump when data arrives. (Spinners are only used inside buttons.)
import { Card, Skeleton } from './ui';

// Generic page: eyebrow, title, a couple of content cards.
export function PageSkeleton({ label = 'Loading' }) {
  return (
    <div aria-busy="true" aria-label={label} className="py-10 sm:py-14">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-2/3 sm:w-1/2" />
      <Skeleton className="mt-3 h-4 w-1/2 sm:w-1/3" />
      <div className="mt-10 space-y-4">
        <Skeleton className="h-28" rounded="rounded-2xl" />
        <Skeleton className="h-28" rounded="rounded-2xl" />
      </div>
    </div>
  );
}

// Event form: three section cards with label + input pairs.
export function FormSkeleton({ label = 'Loading form' }) {
  return (
    <div aria-busy="true" aria-label={label} className="mx-auto max-w-3xl py-10 sm:py-14">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-6 h-10 w-1/2" />
      <div className="mt-10 space-y-6">
        {[3, 1, 2].map((rows, i) => (
          <Card key={i} padding="lg" className="space-y-5">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-11" rounded="rounded-xl" />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

// Attendee table: header row + a few person rows.
export function TableSkeleton({ rows = 3, label = 'Loading attendees' }) {
  return (
    <Card padding="none" aria-busy="true" aria-label={label} className="overflow-hidden">
      <div className="border-b border-line bg-sunken/70 px-5 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-line px-5 py-3.5 last:border-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="hidden h-4 w-44 sm:block" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </Card>
  );
}

// Manage page: header, seat meter card, attendee table.
export function ManageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event" className="py-10 sm:py-14">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-6 h-3 w-16" />
      <Skeleton className="mt-3 h-10 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Card className="mt-8 max-w-md space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-1.5" rounded="rounded-full" />
      </Card>
      <Skeleton className="mt-12 h-7 w-40" />
      <div className="mt-4">
        <TableSkeleton />
      </div>
    </div>
  );
}

// Event detail: title block, details column and the booking card.
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-12 w-3/4" />
      <Skeleton className="mt-4 h-5 w-1/2" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {[100, 85, 92, 60].map((w) => (
            <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
        <Card padding="lg" className="space-y-5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5" rounded="rounded-full" />
          <Skeleton className="h-12" rounded="rounded-full" />
        </Card>
      </div>
    </div>
  );
}
