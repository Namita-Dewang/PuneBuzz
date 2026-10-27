import { useEffect, useRef } from 'react';
import { RotateCw, X } from 'lucide-react';
import EventCard, { EventCardSkeleton } from '../components/EventCard';
import { CategoryChips, MoreFilters, SearchBar } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import WeekendRow from '../components/WeekendRow';
import { Button, EmptyState, SectionHeader, Skeleton } from '../components/ui';
import { useWeekSummary } from '../hooks/useEventHighlights';
import useEventFilters from '../hooks/useEventFilters';
import useEvents from '../hooks/useEvents';
import { getErrorMessage } from '../utils/apiError';
import { PAGE_SIZE } from '../utils/constants';
import cx from '../utils/cx';

const gridClass = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3';

// "42 events this week across 12 neighbourhoods", with a small live dot.
function LiveCount() {
  const { data, isPending, isError } = useWeekSummary();
  if (isError) return null;
  if (isPending) return <Skeleton className="h-5 w-72 max-w-full" />;
  return (
    <p className="flex items-center gap-2.5 text-[15px] text-ink-muted">
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-success" />
      </span>
      {data.events === 0 ? (
        'A quiet week so far. New events are added all the time.'
      ) : (
        <span>
          <strong className="font-semibold tabular-nums text-ink">{data.events}</strong> {data.events === 1 ? 'event' : 'events'} this
          week across <strong className="font-semibold tabular-nums text-ink">{data.neighbourhoods}</strong>{' '}
          {data.neighbourhoods === 1 ? 'neighbourhood' : 'neighbourhoods'}
        </span>
      )}
    </p>
  );
}

export default function HomePage() {
  const { filters, setFilters, clearFilters, activeCount } = useEventFilters();
  const { data, isPending, isError, error, isPlaceholderData, refetch } = useEvents(filters);
  const resultsRef = useRef(null);

  // Bring the top of the results into view when the page number changes.
  // Compares with the previous page (not a "first render" flag), so React
  // StrictMode running this effect twice on mount doesn't scroll on load.
  const previousPage = useRef(filters.page);
  useEffect(() => {
    if (previousPage.current === filters.page) return;
    previousPage.current = filters.page;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filters.page]);

  // The weekend row is a browsing aid: hide it while searching/filtering or paging.
  const showWeekend = activeCount === 0 && filters.page === 1;

  let results;
  if (isPending) {
    results = (
      <div className={gridClass} aria-busy="true" aria-label="Loading events">
        {Array.from({ length: 6 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (isError) {
    results = (
      <EmptyState
        icon="alert"
        title="Couldn't load events"
        message={getErrorMessage(error)}
        action={<Button variant="secondary" onClick={() => refetch()}><RotateCw aria-hidden="true" />Try again</Button>}
      />
    );
  } else if (data.data.length === 0) {
    const pastLastPage = data.total > 0;
    results = pastLastPage ? (
      <EmptyState
        title="Nothing on this page"
        message={`There are only ${data.total} matching events.`}
        action={<Button variant="secondary" onClick={() => setFilters({ page: 1 })}>Go to the first page</Button>}
      />
    ) : activeCount > 0 ? (
      <EmptyState
        icon="search"
        title="No events match your filters"
        message="Try a different area or date range, or clear the filters to see everything coming up."
        action={<Button variant="secondary" onClick={clearFilters}><X aria-hidden="true" />Clear filters</Button>}
      />
    ) : (
      <EmptyState
        title="No upcoming events yet"
        message="Check back soon. New events are added all the time."
        action={<Button variant="secondary" onClick={() => refetch()}><RotateCw aria-hidden="true" />Refresh</Button>}
      />
    );
  } else {
    results = (
      <>
        <div className={cx(gridClass, isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData}>
          {data.data.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <Pagination
          page={data.page}
          limit={data.limit ?? PAGE_SIZE}
          total={data.total}
          onPageChange={(page) => setFilters({ page })}
        />
      </>
    );
  }

  return (
    <div className="pb-8">
      <header className="relative isolate pb-10 pt-12 sm:pb-12 sm:pt-20">
        {/* Warm glow behind the headline. Stays inside the content column, so it can't cause sideways scroll. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 left-0 -z-10 h-[30rem] w-full max-w-4xl bg-[radial-gradient(ellipse_55%_50%_at_30%_45%,var(--pb-glow),transparent_70%),radial-gradient(ellipse_35%_40%_at_70%_30%,var(--pb-glow-2),transparent_70%)]"
        />
        <h1 className="max-w-4xl font-display text-display font-medium text-ink">
          What's happening in <em className="font-normal italic text-accent">Pune</em> this week
        </h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">Gigs, treks, meetups and food walks, one tap from a seat.</p>
        <div className="mt-5">
          <LiveCount />
        </div>
        <div className="mt-8 max-w-2xl">
          <SearchBar filters={filters} onChange={setFilters} />
        </div>
      </header>

      <div className="space-y-5 border-y border-line py-6">
        <CategoryChips filters={filters} onChange={setFilters} />
        <MoreFilters filters={filters} onChange={setFilters} onClear={clearFilters} activeCount={activeCount} />
      </div>

      {showWeekend && <WeekendRow />}

      <section ref={resultsRef} aria-label="Events" className="mt-12 scroll-mt-24 space-y-6 sm:mt-14">
        <SectionHeader
          title={activeCount > 0 ? 'Matching events' : 'All upcoming events'}
          description={!isPending && !isError && data.total > 0 ? `${data.total} ${data.total === 1 ? 'event' : 'events'}, soonest first` : undefined}
        />
        {results}
      </section>
    </div>
  );
}
