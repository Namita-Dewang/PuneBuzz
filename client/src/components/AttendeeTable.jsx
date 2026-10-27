import { formatTimestamp } from '../utils/format';
import { Card } from './ui';

// Confirmed attendees, or the waitlist (kind="waitlist", which shows queue
// position and join time). Scrolls sideways inside its own box on narrow
// screens instead of widening the page.
export default function AttendeeTable({ people, kind = 'confirmed', emptyText }) {
  if (people.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
        {emptyText}
      </p>
    );
  }

  const isWaitlist = kind === 'waitlist';

  return (
    <Card padding="none" className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-line bg-sunken/70 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
          <tr>
            <th scope="col" className="w-14 px-5 py-3 font-semibold">#</th>
            <th scope="col" className="px-5 py-3 font-semibold">Name</th>
            <th scope="col" className="px-5 py-3 font-semibold">Email</th>
            <th scope="col" className="px-5 py-3 font-semibold">{isWaitlist ? 'Joined queue' : 'Booked on'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {people.map((person, i) => (
            <tr key={person.id} className="transition-colors hover:bg-sunken/50">
              <td className="px-5 py-3 font-display tabular-nums text-ink-muted">{isWaitlist ? person.position : i + 1}</td>
              <td className="px-5 py-3 font-medium text-ink">{person.name}</td>
              <td className="px-5 py-3">
                <a href={`mailto:${person.email}`} className="text-ink-muted underline-offset-4 hover:text-accent hover:underline">
                  {person.email}
                </a>
              </td>
              <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink-muted">
                {formatTimestamp(isWaitlist ? person.joinedAt : person.rsvpAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
