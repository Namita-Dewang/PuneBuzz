import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listEvents } from '../api/events';
import { PAGE_SIZE } from '../utils/constants';

export const eventKeys = {
  all: ['events'],
  list: (filters) => ['events', 'list', filters],
  detail: (id) => ['events', 'detail', id],
};

// filters: { q, category, area, from, to, free, page }
export default function useEvents(filters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () => listEvents({ ...filters, limit: PAGE_SIZE }),
    // Keep showing the current page while the next one loads, instead of a blank grid.
    placeholderData: keepPreviousData,
  });
}
