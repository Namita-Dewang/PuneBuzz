import { useQuery } from '@tanstack/react-query';
import { listEvents } from '../api/events';
import { thisWeekRange, weekendRange } from '../utils/format';

// Read-only extras for the home page hero and the "This weekend" row. Both
// use the existing GET /events filters; nothing here writes or changes state.
// Keys live under ['events'] so any event change refreshes them too.

// "42 events this week across 12 neighbourhoods"
export function useWeekSummary() {
  const range = thisWeekRange();
  return useQuery({
    queryKey: ['events', 'week-summary', range],
    queryFn: () => listEvents({ ...range, limit: 100 }),
    select: (page) => ({
      events: page.total,
      neighbourhoods: new Set(page.data.filter((e) => e.venue).map((e) => e.venue.area)).size,
    }),
    staleTime: 60_000,
  });
}

// Events this Saturday and Sunday, for the feature row.
export function useWeekendEvents() {
  const { label, ...range } = weekendRange();
  const query = useQuery({
    queryKey: ['events', 'weekend', range],
    queryFn: () => listEvents({ ...range, limit: 12 }),
    staleTime: 60_000,
  });
  return { ...query, days: label };
}
