import { Link, useNavigate, useParams } from 'react-router';
import EventForm from '../components/EventForm';
import { FormSkeleton } from '../components/Skeletons';
import { Button, EmptyState, Eyebrow, PageHeader, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useEvent from '../hooks/useEvent';
import { useUpdateEvent } from '../hooks/useEventMutations';
import { getErrorMessage } from '../utils/apiError';
import { eventToForm, formToUpdatePayload } from '../utils/eventForm';

function Notice({ icon, title, message, action }) {
  return (
    <div className="py-14">
      <EmptyState icon={icon} title={title} message={message} action={action} />
    </div>
  );
}

// Behind ProtectedRoute. Ownership is checked here (and enforced by the API),
// since a demoted organizer still owns their existing events.
export default function EditEventPage() {
  const { id: rawId } = useParams();
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const { data: event, isPending, isError, error, refetch } = useEvent(id);
  const { canManage } = useAuth();
  const updateEvent = useUpdateEvent(id);
  const navigate = useNavigate();
  const toast = useToast();

  if (!id || (isError && error.response?.status === 404)) {
    return <Notice icon="search" title="Event not found" action={<Button as={Link} to="/me?tab=organizing" variant="secondary">Back to my events</Button>} />;
  }
  if (isPending) return <FormSkeleton label="Loading event" />;
  if (isError) {
    return <Notice icon="alert" title="Couldn't load this event" message={getErrorMessage(error)} action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />;
  }
  if (!canManage(event)) {
    return <Notice icon="alert" title="You can't edit this event" message="Only its organizer can make changes." action={<Button as={Link} to={`/events/${id}`} variant="secondary">View event</Button>} />;
  }
  if (event.status === 'cancelled') {
    return <Notice title="This event was cancelled" message="Cancelled events can't be edited." action={<Button as={Link} to={`/events/${id}/manage`} variant="secondary">View attendees</Button>} />;
  }

  const original = eventToForm(event);

  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <Link to={`/events/${id}/manage`} className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
        <span aria-hidden="true">←</span> Manage event
      </Link>
      <PageHeader
        className="mt-6"
        eyebrow={<Eyebrow>Edit event</Eyebrow>}
        title={event.title}
        description="Changes go live as soon as you save. People who've booked keep their seats."
      />
      <div className="mt-10">
        {/* key: start fresh if a different event is loaded into this page */}
        <EventForm
          key={event.id}
          initialValues={original}
          event={event}
          submitLabel="Save changes"
          cancelTo={`/events/${id}/manage`}
          onSubmit={async (values) => {
            const changes = formToUpdatePayload(values, original);
            if (Object.keys(changes).length) {
              await updateEvent.mutateAsync(changes);
              toast.show('Changes saved.', 'success');
            }
            navigate(`/events/${id}/manage`);
          }}
        />
      </div>
    </div>
  );
}
