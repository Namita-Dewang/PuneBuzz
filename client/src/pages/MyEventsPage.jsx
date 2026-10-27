import { Link, useSearchParams } from 'react-router';
import CategoryLabel from '../components/CategoryLabel';
import EventStatusBadge from '../components/EventStatusBadge';
import { Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Eyebrow, PageHeader, Skeleton, Tabs } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useMyEvents from '../hooks/useMyEvents';
import { getErrorMessage } from '../utils/apiError';
import { eventDateParts, formatEventDate, hasStarted } from '../utils/format';

function EventRow({ event, organizing }) {
  const isActive = event.status !== 'cancelled' && !hasStarted(event.startsAt);
  const { month, day } = eventDateParts(event.startsAt);
  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex w-12 shrink-0 flex-col items-center leading-none" aria-hidden="true">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{month}</span>
          <span className="mt-1 font-display text-2xl font-medium tabular-nums text-ink">{day}</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryLabel category={event.category} />
            <EventStatusBadge event={event} />
            {event.position && isActive && <Badge tone="warning" className="tabular-nums">#{event.position} in line</Badge>}
          </div>
          <Link
            to={`/events/${event.id}`}
            className="mt-1.5 block truncate rounded font-display text-lg font-medium text-ink transition-colors duration-150 hover:text-accent"
          >
            {event.title}
          </Link>
          <p className="mt-0.5 text-sm tabular-nums text-ink-muted">
            {formatEventDate(event.startsAt)}
            {event.venue && ` · ${event.venue.area}`}
          </p>
        </div>
      </div>

      {organizing ? (
        <div className="flex shrink-0 items-center gap-2 pl-16 sm:pl-0">
          <span className="mr-2 text-sm tabular-nums text-ink-muted">
            {event.seatsTaken}/{event.capacity} seats
          </span>
          {event.status !== 'cancelled' && (
            <Button as={Link} to={`/events/${event.id}/edit`} variant="ghost" size="sm">Edit</Button>
          )}
          <Button as={Link} to={`/events/${event.id}/manage`} variant="secondary" size="sm">Manage</Button>
        </div>
      ) : (
        <div className="pl-16 sm:pl-0">
          <Button as={Link} to={`/events/${event.id}`} variant="secondary" size="sm" className="shrink-0">View</Button>
        </div>
      )}
    </li>
  );
}

// Upcoming first (soonest at the top), then past and cancelled ones (most recent first).
function EventList({ events, organizing }) {
  const upcoming = events.filter((e) => e.status !== 'cancelled' && !hasStarted(e.startsAt));
  const past = events.filter((e) => !upcoming.includes(e)).reverse();
  return (
    <div className="space-y-10">
      {upcoming.length > 0 && (
        <Card as="ul" padding="none" className="divide-y divide-line">
          {upcoming.map((e) => <EventRow key={e.id} event={e} organizing={organizing} />)}
        </Card>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="font-display text-heading font-medium text-ink-muted">Past and cancelled</h2>
          <Card as="ul" padding="none" className="mt-4 divide-y divide-line opacity-80">
            {past.map((e) => <EventRow key={e.id} event={e} organizing={organizing} />)}
          </Card>
        </section>
      )}
    </div>
  );
}

const EMPTY = {
  attending: {
    title: "You're not going to anything yet",
    message: 'Find something you like and book a seat.',
    action: <Button as={Link} to="/" variant="secondary">Browse events</Button>,
  },
  waitlisted: {
    title: "You're not on any waitlists",
    message: "When an event is full, you can join its waitlist and you'll get a seat automatically if one frees up.",
    action: <Button as={Link} to="/" variant="secondary">Browse events</Button>,
  },
  organizing: {
    title: "You haven't created any events",
    message: 'Create your first event; you can save it as a draft until it\'s ready.',
    action: <Button as={Link} to="/events/new">Create an event</Button>,
  },
};

export default function MyEventsPage() {
  const { hasRole } = useAuth();
  const isOrganizer = hasRole('organizer', 'admin');
  const { data, isPending, isError, error, refetch } = useMyEvents();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    { key: 'attending', label: 'Attending' },
    { key: 'waitlisted', label: 'Waitlisted' },
    // Hidden from regular users. Shown anyway if they somehow own events
    // (e.g. an organizer who was demoted) so those stay manageable.
    ...(isOrganizer || data?.organizing.length ? [{ key: 'organizing', label: 'Organizing' }] : []),
  ];
  const requested = searchParams.get('tab');
  const active = tabs.some((t) => t.key === requested) ? requested : 'attending';

  function selectTab(key) {
    setSearchParams(key === 'attending' ? {} : { tab: key }, { replace: true });
  }

  let panel;
  if (isPending) {
    panel = (
      <Card as="ul" padding="none" aria-busy="true" aria-label="Loading your events" className="divide-y divide-line">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex gap-4 px-5 py-4">
            <Skeleton className="h-10 w-12" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </li>
        ))}
      </Card>
    );
  } else if (isError) {
    panel = (
      <EmptyState
        icon="alert"
        title="Couldn't load your events"
        message={getErrorMessage(error)}
        action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>}
      />
    );
  } else if (data[active].length === 0) {
    panel = <EmptyState {...EMPTY[active]} />;
  } else {
    panel = <EventList events={data[active]} organizing={active === 'organizing'} />;
  }

  return (
    <div className="py-10 sm:py-14">
      <PageHeader
        eyebrow={<Eyebrow>Your Pune Buzz</Eyebrow>}
        title="My events"
        description="Everything you've booked, are waiting for, or are putting on."
        actions={
          isOrganizer && (
            <Button as={Link} to="/events/new">
              <Plus aria-hidden="true" />
              Create event
            </Button>
          )
        }
      />

      <Tabs
        className="mt-8"
        label="My events"
        items={tabs.map((t) => ({ ...t, count: data?.[t.key].length }))}
        value={active}
        onChange={selectTab}
      />

      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="mt-8">
        {panel}
      </div>
    </div>
  );
}
