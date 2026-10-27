import { Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { eventDateParts } from '../../utils/format';
import CategoryLabel from '../CategoryLabel';
import { CalendarBlock } from '../EventCard';
import { Card, Skeleton } from '../ui';
import RoleRow from './RoleRow';

// An event that needs volunteers: date block, title (links to the event),
// venue and area, then its open roles inside the card.
export default function VolunteerEventCard({ event, onApply }) {
  const { time } = eventDateParts(event.startsAt);
  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <div className="shrink-0">
          <CalendarBlock iso={event.startsAt} />
        </div>
        <div className="min-w-0">
          <CategoryLabel category={event.category} />
          <h2 className="mt-1.5 font-display text-[1.3rem] font-medium leading-snug">
            <Link to={`/events/${event.id}`} className="rounded text-ink transition-colors duration-150 hover:text-accent">
              {event.title}
            </Link>
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
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
        </div>
      </div>

      <div className="mt-auto border-t border-line bg-sunken/40 px-5 sm:px-6">
        <p className="pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          {event.roles.length === 1 ? 'Volunteer role' : 'Volunteer roles'}
        </p>
        <ul className="divide-y divide-line">
          {event.roles.map((role) => (
            <RoleRow key={role.id} role={role} onApply={(r) => onApply({ role: r, eventTitle: event.title })} />
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function VolunteerEventCardSkeleton() {
  return (
    <Card padding="none" aria-hidden="true" className="overflow-hidden">
      <div className="flex gap-4 p-5 sm:p-6">
        <div className="h-[5.25rem] w-16 shrink-0 rounded-xl border border-line bg-surface" />
        <div className="flex-1 space-y-2.5 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-4 border-t border-line bg-sunken/40 px-5 py-4 sm:px-6">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-20" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
