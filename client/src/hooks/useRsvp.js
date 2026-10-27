import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelRsvp, rsvp } from '../api/events';
import { getErrorCode, getErrorMessage } from '../utils/apiError';
import { useToast } from '../components/ui';
import { eventKeys } from './useEvents';

export const rsvpMutationKey = (id) => ['rsvp', id];

// What the event will look like once the server accepts the RSVP. Mirrors
// rsvp.service: a free seat confirms you, otherwise you join the end of the queue.
function afterJoin(event) {
  if (event.seatsLeft > 0) {
    return {
      ...event,
      seatsTaken: event.seatsTaken + 1,
      seatsLeft: event.seatsLeft - 1,
      myStatus: { status: 'confirmed' },
    };
  }
  return {
    ...event,
    waitlistCount: event.waitlistCount + 1,
    myStatus: { status: 'waitlisted', position: event.waitlistCount + 1 },
  };
}

// Mirrors cancel(): leaving the waitlist frees nothing; giving up a seat
// either passes it to waitlist #1 (seat count unchanged) or frees it.
function afterLeave(event) {
  const base = { ...event, myStatus: { status: 'none' } };
  if (event.myStatus?.status === 'waitlisted') {
    return { ...base, waitlistCount: Math.max(0, event.waitlistCount - 1) };
  }
  if (event.waitlistCount > 0) {
    return { ...base, waitlistCount: event.waitlistCount - 1 };
  }
  return { ...base, seatsTaken: event.seatsTaken - 1, seatsLeft: event.seatsLeft + 1 };
}

// Optimistic RSVP / cancel for the event detail page. The UI updates at once;
// if the API refuses (e.g. 409 because the event just closed or you already
// joined in another tab), the previous state is restored and a toast explains.
export default function useRsvp(id) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = eventKeys.detail(id);

  function optimistic(apply) {
    return async () => {
      // Stop any in-flight fetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      if (previous) queryClient.setQueryData(key, apply(previous));
      return { previous };
    };
  }

  function rollback(fallback) {
    return (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      const conflict = getErrorCode(error) && error.response?.status === 409;
      toast.show(conflict ? getErrorMessage(error) : fallback, 'error');
    };
  }

  // Whatever happened, re-sync this event and everything that lists it.
  async function resync() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ['events', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['me', 'events'] }),
    ]);
  }

  const join = useMutation({
    mutationKey: rsvpMutationKey(id),
    mutationFn: () => rsvp(id),
    onMutate: optimistic(afterJoin),
    onSuccess: (result) => {
      // Trust the server's answer over our guess (e.g. the last seat went
      // to someone else a moment earlier, so we were waitlisted instead).
      queryClient.setQueryData(key, (event) => event && { ...event, myStatus: result });
      toast.show(
        result.status === 'confirmed' ? "You're going! See you there." : `You're #${result.position} in line.`,
        'success',
        { duration: 2500 } // short: the button itself carries the success moment
      );
    },
    onError: rollback("Couldn't book your seat. Please try again."),
    onSettled: resync,
  });

  const leave = useMutation({
    mutationKey: rsvpMutationKey(id),
    mutationFn: () => cancelRsvp(id),
    onMutate: optimistic(afterLeave),
    onSuccess: (result) => {
      toast.show(result.status === 'left_waitlist' ? 'You left the waitlist.' : 'Your booking was cancelled.', 'success');
    },
    onError: rollback("Couldn't cancel. Please try again."),
    onSettled: resync,
  });

  return { join, leave, isPending: join.isPending || leave.isPending };
}
