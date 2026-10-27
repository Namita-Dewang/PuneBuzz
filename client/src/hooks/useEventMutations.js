import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelEvent, createEvent, updateEvent } from '../api/events';

// Any change to an event can affect every list, detail and attendee view it
// appears in, so invalidate all of them. The responses don't carry
// waitlistCount/myStatus, so refetching beats writing them into the cache.
function useInvalidateEvents() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['me', 'events'] }),
    ]);
}

export function useCreateEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({ mutationFn: createEvent, onSuccess: invalidate });
}

export function useUpdateEvent(id) {
  const invalidate = useInvalidateEvents();
  return useMutation({ mutationFn: (changes) => updateEvent(id, changes), onSuccess: invalidate });
}

export function useCancelEvent(id) {
  const invalidate = useInvalidateEvents();
  return useMutation({ mutationFn: () => cancelEvent(id), onSuccess: invalidate });
}
