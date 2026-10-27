import { ArrowLeft, CalendarDays, ExternalLink, MapPin, RotateCw, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router';
import CategoryLabel from '../components/CategoryLabel';
import RsvpButton, { rsvpState } from '../components/RsvpButton';
import SeatMeter from '../components/SeatMeter';
import { DetailSkeleton } from '../components/Skeletons';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useEvent from '../hooks/useEvent';
import { getErrorMessage } from '../utils/apiError';
import cx from '../utils/cx';
import { formatEventRange, formatPrice } from '../utils/format';

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden="true" /> All events
    </Link>
  );
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-4 py-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{label}</dt>
        <dd className="mt-1 text-[15px] tabular-nums text-ink">{children}</dd>
      </div>
    </div>
  );
}

function mapsUrl(venue) {
  const query = venue.lat != null && venue.lng != null
    ? `${venue.lat},${venue.lng}`
    : [venue.name, venue.address ?? venue.area, 'Pune'].join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function EventDetailPage() {
  const { id: rawId } = useParams();
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const { data: event, isPending, isError, error, refetch } = useEvent(id);
  const { user, canManage } = useAuth();

  let content;
  if (!id || (isError && error.response?.status === 404)) {
    content = (
      <EmptyState
        icon="search"
        title="Event not found"
        message="It may have been removed, or the link is wrong."
        action={<Button as={Link} to="/" variant="secondary"><ArrowLeft aria-hidden="true" />Back to all events</Button>}
      />
    );
  } else if (isPending) {
    content = <DetailSkeleton />;
  } else if (isError) {
    content = (
      <EmptyState
        icon="alert"
        title="Couldn't load this event"
        message={getErrorMessage(error)}
        action={<Button variant="secondary" onClick={() => refetch()}><RotateCw aria-hidden="true" />Try again</Button>}
      />
    );
  } else {
    content = (
      <article>
        <div className="flex flex-wrap items-center gap-3">
          <CategoryLabel category={event.category} />
          {event.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
          {event.status === 'draft' && <Badge tone="neutral">Draft</Badge>}
        </div>
        <h1 className="mt-4 max-w-4xl font-display text-display font-medium text-ink">{event.title}</h1>

        {canManage(event) && (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-accent/25 bg-accent-soft/60 px-5 py-3 text-sm">
            <span className="mr-auto text-ink">You're organizing this event.</span>
            {event.status !== 'cancelled' && (
              <Link to={`/events/${event.id}/edit`} className="rounded font-medium text-accent underline-offset-4 hover:underline">Edit</Link>
            )}
            <Link to={`/events/${event.id}/manage`} className="rounded font-medium text-accent underline-offset-4 hover:underline">
              Manage attendees
            </Link>
          </div>
        )}

        {/* Desktop: details left, sticky booking card right. Mobile: one
            column, with the booking control docked to the bottom of the screen. */}
        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
          <div className="min-w-0">
            <dl className="divide-y divide-line border-y border-line">
              <DetailRow icon={CalendarDays} label="When">
                {formatEventRange(event.startsAt, event.endsAt)}
              </DetailRow>
              <DetailRow icon={MapPin} label="Where">
                {event.venue ? (
                  <>
                    <span className="font-medium">{event.venue.name}</span>, {event.venue.area}
                    {event.venue.address && <span className="mt-0.5 block text-ink-muted">{event.venue.address}</span>}
                    <a
                      href={mapsUrl(event.venue)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 rounded font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Open in Maps <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </>
                ) : (
                  'Venue to be announced'
                )}
              </DetailRow>
              <DetailRow icon={UserRound} label="Organizer">{event.organizer.name}</DetailRow>
            </dl>

            <h2 className="mt-10 font-display text-heading font-medium text-ink">About this event</h2>
            <p className="mt-3 max-w-prose whitespace-pre-line text-[17px] leading-[1.75] text-ink-muted">
              {event.description || 'No description yet.'}
            </p>
          </div>

          <aside className="row-start-1 lg:col-start-2 lg:row-start-auto">
            <Card padding="lg" className="space-y-6 lg:sticky lg:top-24">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cx('font-display text-[2rem] font-medium leading-none', event.isFree ? 'text-success' : 'text-ink')}>
                  {formatPrice(event.price)}
                </p>
                {!event.isFree && <p className="text-xs text-ink-muted">per person</p>}
              </div>
              <SeatMeter
                capacity={event.capacity}
                seatsTaken={event.seatsTaken}
                seatsLeft={event.seatsLeft}
                waitlistCount={event.waitlistCount}
              />
              {/* One RsvpButton: in the card on desktop, docked at the bottom on mobile. */}
              {/* max-lg:m-0 cancels the card's space-y margin, which would lift the fixed bar. */}
              <div
                data-booking-dock
                className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:m-0 max-lg:border-t max-lg:border-line max-lg:bg-surface/95 max-lg:px-4 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pt-3 max-lg:shadow-pop max-lg:backdrop-blur-md"
              >
                <div className="mx-auto max-w-xl">
                  <RsvpButton event={event} />
                </div>
              </div>
              {rsvpState(event, user).kind !== 'closed' && (
                <p className="text-center text-xs text-ink-subtle">Seat count refreshes every 15 seconds.</p>
              )}
            </Card>
          </aside>
        </div>
      </article>
    );
  }

  return (
    <div className="pb-14 pt-10 sm:pt-14">
      {event && <div className="mb-8"><BackLink /></div>}
      {content}
    </div>
  );
}
