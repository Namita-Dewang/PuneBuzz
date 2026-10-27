import { useState } from 'react';
import { Link, useParams } from 'react-router';
import AttendeeTable from '../components/AttendeeTable';
import EventStatusBadge from '../components/EventStatusBadge';
import SeatMeter from '../components/SeatMeter';
import { ManageSkeleton, TableSkeleton } from '../components/Skeletons';
import CategoryLabel from '../components/CategoryLabel';
import { Button, Card, EmptyState, Eyebrow, Modal, PageHeader, SectionHeader, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useAttendees from '../hooks/useAttendees';
import useEvent from '../hooks/useEvent';
import { useCancelEvent } from '../hooks/useEventMutations';
import { getErrorMessage } from '../utils/apiError';
import { formatEventRange, formatPrice } from '../utils/format';

function Notice({ title, message, action, icon }) {
  return (
    <div className="py-14">
      <EmptyState icon={icon} title={title} message={message} action={action} />
    </div>
  );
}

// Behind ProtectedRoute; the API returns 403 to anyone but the organizer or an admin.
export default function ManageEventPage() {
  const { id: rawId } = useParams();
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const { canManage } = useAuth();
  const eventQuery = useEvent(id);
  const event = eventQuery.data;
  const allowed = canManage(event);
  const attendees = useAttendees(allowed ? id : null);
  const cancelEvent = useCancelEvent(id);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  if (!id || eventQuery.error?.response?.status === 404) {
    return <Notice icon="search" title="Event not found" action={<Button as={Link} to="/me?tab=organizing" variant="secondary">Back to my events</Button>} />;
  }
  if (eventQuery.isPending) return <ManageSkeleton />;
  if (eventQuery.isError) {
    return <Notice icon="alert" title="Couldn't load this event" message={getErrorMessage(eventQuery.error)} action={<Button variant="secondary" onClick={() => eventQuery.refetch()}>Try again</Button>} />;
  }
  if (!allowed) {
    return <Notice icon="alert" title="You can't manage this event" message="Only its organizer can see the attendee list." action={<Button as={Link} to={`/events/${id}`} variant="secondary">View event</Button>} />;
  }

  const isCancelled = event.status === 'cancelled';
  const confirmedCount = attendees.data?.confirmed.length ?? event.seatsTaken;
  const waitingCount = attendees.data?.waitlist.length ?? event.waitlistCount;

  async function handleCancel() {
    try {
      await cancelEvent.mutateAsync();
      setConfirming(false);
      toast.show('Event cancelled.', 'success');
    } catch (err) {
      setConfirming(false);
      toast.show(getErrorMessage(err), 'error');
    }
  }

  return (
    <div className="py-10 sm:py-14">
      <Link to="/me?tab=organizing" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink">
        <span aria-hidden="true">←</span> My events
      </Link>

      <PageHeader
        className="mt-6"
        eyebrow={
          <>
            <Eyebrow>Manage</Eyebrow>
            <CategoryLabel category={event.category} variant="badge" />
            <EventStatusBadge event={event} />
          </>
        }
        title={event.title}
        meta={
          <span className="tabular-nums">
            {formatEventRange(event.startsAt, event.endsAt)}
            {event.venue && ` · ${event.venue.name}, ${event.venue.area}`} · {formatPrice(event.price)}
          </span>
        }
        actions={
          <>
            <Button as={Link} to={`/events/${id}`} variant="secondary" size="sm">
              View page
            </Button>
            {!isCancelled && (
              <>
                <Button as={Link} to={`/events/${id}/edit`} variant="secondary" size="sm">
                  Edit
                </Button>
                <Button variant="danger-outline" size="sm" onClick={() => setConfirming(true)}>
                  Cancel event
                </Button>
              </>
            )}
          </>
        }
      />

      {isCancelled && (
        <p className="mt-8 rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger">
          This event has been cancelled. The lists below are kept for your records.
        </p>
      )}

      <Card className="mt-8 max-w-md">
        <SeatMeter capacity={event.capacity} seatsTaken={event.seatsTaken} seatsLeft={event.seatsLeft} waitlistCount={event.waitlistCount} />
      </Card>

      {attendees.isPending ? (
        <div className="mt-12"><TableSkeleton /></div>
      ) : attendees.isError ? (
        <div className="mt-10"><EmptyState icon="alert" title="Couldn't load attendees" message={getErrorMessage(attendees.error)} action={<Button variant="secondary" onClick={() => attendees.refetch()}>Try again</Button>} /></div>
      ) : (
        <>
          <section className="mt-12">
            <SectionHeader
              title={<>Attending <span className="font-sans text-base font-normal tabular-nums text-ink-muted">({confirmedCount})</span></>}
              description="Confirmed seats, in booking order."
            />
            <div className="mt-5">
              <AttendeeTable people={attendees.data.confirmed} emptyText="No one has booked a seat yet." />
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader
              title={<>Waitlist <span className="font-sans text-base font-normal tabular-nums text-ink-muted">({waitingCount})</span></>}
              description="In queue order. When someone cancels, #1 gets their seat automatically."
            />
            <div className="mt-5">
              <AttendeeTable people={attendees.data.waitlist} kind="waitlist" emptyText="No one is waiting." />
            </div>
          </section>
        </>
      )}

      <Modal
        open={confirming}
        title="Cancel this event?"
        pending={cancelEvent.isPending}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={cancelEvent.isPending}>
              Keep event
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelEvent.isPending}>
              {cancelEvent.isPending ? 'Cancelling…' : 'Yes, cancel event'}
            </Button>
          </>
        }
      >
        <p>
          <strong className="font-semibold text-ink">{event.title}</strong> will be marked as cancelled and closed to new bookings.
        </p>
        {confirmedCount + waitingCount > 0 && (
          <p>
            {[
              confirmedCount > 0 && `${confirmedCount} ${confirmedCount === 1 ? 'person has' : 'people have'} a seat`,
              waitingCount > 0 && `${waitingCount} ${waitingCount === 1 ? 'is' : 'are'} on the waitlist`,
            ]
              .filter(Boolean)
              .join(' and ')}
            . They'll see it's cancelled on the event page.
          </p>
        )}
        <p className="font-medium text-ink">This can't be undone.</p>
      </Modal>
    </div>
  );
}
