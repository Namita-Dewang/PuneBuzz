import { useIsMutating, useQuery } from '@tanstack/react-query';
import { getEvent } from '../api/events';
import { eventKeys } from './useEvents';
import { rsvpMutationKey } from './useRsvp';

const REFRESH_MS = 15_000;

// Event detail, refetched every 15 s so the seat meter stays roughly live.
// Polling pauses while an RSVP is in flight so a poll can't briefly
// overwrite the optimistic state with the pre-RSVP snapshot, and stops for
// cancelled events, whose seats can't change any more.
export default function useEvent(id) {
  const rsvpInFlight = useIsMutating({ mutationKey: rsvpMutationKey(id) }) > 0;

  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => getEvent(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      rsvpInFlight || query.state.data?.status === 'cancelled' ? false : REFRESH_MS,
  });
}
