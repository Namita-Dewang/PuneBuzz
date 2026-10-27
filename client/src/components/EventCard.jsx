import { Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import cx from '../utils/cx';
import { CATEGORY_ICONS, categoryTheme } from '../utils/constants';
import { eventDateParts, formatPrice } from '../utils/format';
import CategoryLabel from './CategoryLabel';
import { Badge, Card, Skeleton } from './ui';

// "Few left" when 3 or fewer, or under 10% of capacity.
function isAlmostFull(seatsLeft, capacity) {
  return seatsLeft > 0 && seatsLeft <= Math.max(3, Math.ceil(capacity * 0.1));
}

// Calendar block: month small on a coloured strip, day number large.
export function CalendarBlock({ iso, size = 'md' }) {
  const { month, day, weekday } = eventDateParts(iso);
  return (
    <div
      className={cx(
        'overflow-hidden rounded-xl border border-line bg-surface text-center shadow-soft',
        size === 'lg' ? 'w-[4.5rem]' : 'w-16'
      )}
    >
      <div className="bg-accent py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-accent">{month}</div>
      <div className={cx('font-display font-medium leading-tight tabular-nums text-ink', size === 'lg' ? 'text-[2rem]' : 'text-[1.75rem]')}>
        {day}
      </div>
      <div className="pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-subtle">{weekday}</div>
    </div>
  );
}

function SeatsBar({ seatsTaken, capacity, seatsLeft }) {
  const percent = capacity > 0 ? Math.min(100, Math.round((seatsTaken / capacity) * 100)) : 0;
  const color = seatsLeft <= 0 ? 'bg-warning' : isAlmostFull(seatsLeft, capacity) ? 'bg-accent' : 'bg-success';
  return (
    <div className="h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
      <div className={cx('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
    </div>
  );
}

function Availability({ seatsLeft, capacity }) {
  if (seatsLeft <= 0) return <Badge tone="warning" dot>Waitlist open</Badge>;
  if (isAlmostFull(seatsLeft, capacity)) {
    return (
      <Badge tone="accent" dot className="tabular-nums">
        {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
      </Badge>
    );
  }
  return (
    <span className="text-[13px] tabular-nums text-ink-muted">
      {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
    </span>
  );
}

function Meta({ event }) {
  const { time } = eventDateParts(event.startsAt);
  return (
    <ul className="space-y-1.5 text-sm text-ink-muted">
      <li className="flex items-center gap-2 tabular-nums">
        <Clock className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        {time}
      </li>
      <li className="flex min-w-0 items-center gap-2">
        <MapPin className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span className="truncate">
          {event.venue ? (
            <>
              {event.venue.name}
              <span className="text-ink-subtle"> · {event.venue.area}</span>
            </>
          ) : (
            'Venue to be announced'
          )}
        </span>
      </li>
    </ul>
  );
}

function Footer({ event }) {
  return (
    <div className="space-y-3">
      <SeatsBar seatsTaken={event.seatsTaken} capacity={event.capacity} seatsLeft={event.seatsLeft} />
      <div className="flex items-center justify-between gap-3">
        <Availability seatsLeft={event.seatsLeft} capacity={event.capacity} />
        <span className={cx('text-[15px] font-semibold tabular-nums', event.isFree ? 'text-success' : 'text-ink')}>
          {formatPrice(event.price)}
        </span>
      </div>
    </div>
  );
}

export default function EventCard({ event }) {
  const theme = categoryTheme(event.category);
  return (
    <Card as={Link} to={`/events/${event.id}`} interactive padding="none" className="group flex flex-col overflow-hidden">
      {/* Category band with the date block overlapping its bottom edge. */}
      <div className={cx('relative h-24', theme.band)}>
        <CategoryLabel category={event.category} variant="pill" className="absolute right-4 top-4" />
        <div className="absolute -bottom-8 left-5">
          <CalendarBlock iso={event.startsAt} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-11">
        <h3 className="line-clamp-2 font-display text-[1.25rem] font-medium leading-snug text-ink transition-colors duration-150 group-hover:text-accent">
          {event.title}
        </h3>
        <div className="mt-3">
          <Meta event={event} />
        </div>
        <div className="mt-auto pt-5">
          <Footer event={event} />
        </div>
      </div>
    </Card>
  );
}

// Larger card for the "This weekend" row: taller band with a big faded
// category icon, bigger date and title.
export function FeatureCard({ event }) {
  const theme = categoryTheme(event.category);
  const Icon = CATEGORY_ICONS[event.category] ?? CATEGORY_ICONS.all;
  return (
    <Card
      as={Link}
      to={`/events/${event.id}`}
      interactive
      padding="none"
      className="group flex w-[min(19rem,82vw)] shrink-0 snap-start flex-col overflow-hidden sm:w-[22rem]"
    >
      <div className={cx('relative h-36 overflow-hidden', theme.band)}>
        <Icon className={cx('absolute -right-4 -top-3 size-36', theme.glyph)} strokeWidth={1.25} aria-hidden="true" />
        <CategoryLabel category={event.category} variant="pill" className="absolute left-5 top-5" />
        <div className="absolute bottom-4 left-5">
          <CalendarBlock iso={event.startsAt} size="lg" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 font-display text-[1.45rem] font-medium leading-snug text-ink transition-colors duration-150 group-hover:text-accent">
          {event.title}
        </h3>
        <div className="mt-3">
          <Meta event={event} />
        </div>
        <div className="mt-auto pt-5">
          <Footer event={event} />
        </div>
      </div>
    </Card>
  );
}

// Same shape as EventCard: band, overlapping date block, title, two meta
// lines, seats bar and footer row.
export function EventCardSkeleton() {
  return (
    <Card padding="none" aria-hidden="true" className="flex flex-col overflow-hidden">
      <div className="relative h-24 bg-sunken/70">
        <Skeleton className="absolute right-4 top-4 h-6 w-20" rounded="rounded-full" />
        <div className="absolute -bottom-8 left-5 h-[5.25rem] w-16 rounded-xl border border-line bg-surface" />
      </div>
      <div className="space-y-3 px-5 pb-5 pt-11">
        <Skeleton className="h-6 w-11/12" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-5 h-1" rounded="rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </Card>
  );
}

export function FeatureCardSkeleton() {
  return (
    <Card padding="none" aria-hidden="true" className="flex w-[min(19rem,82vw)] shrink-0 flex-col overflow-hidden sm:w-[22rem]">
      <div className="relative h-36 bg-sunken/70">
        <Skeleton className="absolute left-5 top-5 h-6 w-20" rounded="rounded-full" />
        <div className="absolute bottom-4 left-5 h-[5.6rem] w-[4.5rem] rounded-xl border border-line bg-surface" />
      </div>
      <div className="space-y-3 p-5">
        <Skeleton className="h-7 w-11/12" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-5 h-1" rounded="rounded-full" />
      </div>
    </Card>
  );
}
