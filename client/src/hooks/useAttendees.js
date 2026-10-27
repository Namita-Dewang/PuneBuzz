import { useQuery } from '@tanstack/react-query';
import { getAttendees } from '../api/events';

export const attendeesKey = (id) => ['events', 'attendees', id];

export default function useAttendees(id) {
  return useQuery({
    queryKey: attendeesKey(id),
    queryFn: () => getAttendees(id),
    enabled: Boolean(id),
    refetchInterval: 30_000, // organizers often keep this open on event day
  });
}
