import { useNavigate } from 'react-router';
import EventForm from '../components/EventForm';
import { Eyebrow, PageHeader, useToast } from '../components/ui';
import { useCreateEvent } from '../hooks/useEventMutations';
import { EMPTY_FORM, formToCreatePayload } from '../utils/eventForm';

// Behind ProtectedRoute roles={['organizer', 'admin']}.
export default function CreateEventPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createEvent = useCreateEvent();

  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <PageHeader
        eyebrow={<Eyebrow>For organizers</Eyebrow>}
        title="Create an event"
        description="You can edit everything later, except that capacity can't drop below seats already taken."
      />
      <div className="mt-10">
        <EventForm
          initialValues={EMPTY_FORM}
          submitLabel="Create event"
          cancelTo="/me?tab=organizing"
          onSubmit={async (values) => {
            const event = await createEvent.mutateAsync(formToCreatePayload(values));
            toast.show(event.status === 'draft' ? 'Draft saved.' : 'Event published!', 'success');
            navigate(`/events/${event.id}/manage`, { replace: true });
          }}
        />
      </div>
    </div>
  );
}
