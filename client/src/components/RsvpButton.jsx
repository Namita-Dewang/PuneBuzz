import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Hourglass, Lock, LogIn, Ticket, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import useRsvp from '../hooks/useRsvp';
import cx from '../utils/cx';
import { hasStarted } from '../utils/format';
import { Button, Skeleton } from './ui';

// How long the "You're going!" button stays before settling into the panel.
const CELEBRATE_MS = 1600;

// Which state the button is in. Order matters: a closed event is closed
// for everyone, whatever their RSVP status.
export function rsvpState(event, user) {
  if (event.status === 'cancelled') return { kind: 'closed', reason: 'This event has been cancelled.' };
  if (event.status === 'draft') return { kind: 'closed', reason: "This event isn't published yet." };
  if (hasStarted(event.startsAt)) return { kind: 'closed', reason: 'Bookings are closed. This event has already started.' };
  if (!user) return { kind: 'login' };
  const status = event.myStatus?.status;
  if (status === 'confirmed') return { kind: 'confirmed' };
  if (status === 'waitlisted') return { kind: 'waitlisted', position: event.myStatus.position };
  return event.seatsLeft > 0 ? { kind: 'open' } : { kind: 'full' };
}

// Coloured status panel with an icon: green = confirmed, amber = waitlisted,
// stone = closed. Each state is recognisable by colour, icon and wording.
const PANEL_TONES = {
  success: { box: 'border-success/30 bg-success-soft', icon: 'bg-success text-on-accent', title: 'text-success' },
  warning: { box: 'border-warning/30 bg-warning-soft', icon: 'bg-warning text-on-accent', title: 'text-warning' },
  closed: { box: 'border-line bg-closed-soft', icon: 'bg-closed text-on-accent', title: 'text-ink' },
};

function Panel({ tone, icon: Icon, title, children }) {
  const style = PANEL_TONES[tone];
  return (
    <div className={cx('rounded-xl border px-4 py-3.5', style.box)}>
      <div className="flex items-start gap-3">
        <span className={cx('grid size-8 shrink-0 place-items-center rounded-full', style.icon)}>
          <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cx('font-display text-[1.1rem] font-semibold leading-snug', style.title)}>{title}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

// Animated check for the success moment: the circle pops in and the tick
// draws itself. motion-safe: only, so reduced-motion users see it static.
function SuccessCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5 motion-safe:animate-check-pop">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.22" />
      <path
        d="m7.5 12.5 3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24"
        className="motion-safe:animate-check-draw"
      />
    </svg>
  );
}

// Two-step "are you sure?" so a stray tap can't give away a seat or a place in line.
function LeaveControl({ label, confirmText, onConfirm, disabled }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setConfirming(true)} disabled={disabled}>
        {label}
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-2.5">
      <p className="text-sm text-ink-muted">{confirmText}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          disabled={disabled}
        >
          Yes, {label.toLowerCase()}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

function Note({ children }) {
  return <p className="mt-2 text-center text-[13px] text-ink-muted">{children}</p>;
}

export default function RsvpButton({ event }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { join, leave, isPending } = useRsvp(event.id);

  // Purely visual: after "Book a seat" is clicked, the same button turns
  // green with a check for a moment before the confirmed panel appears.
  // If the booking fails or ends up on the waitlist, the state below wins
  // and this is simply ignored.
  const [celebrating, setCelebrating] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function book() {
    setCelebrating(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
    join.mutate();
  }

  if (isLoading) return <Skeleton className="h-12" rounded="rounded-full" />;

  const state = rsvpState(event, user);

  // Same <Button> in the same place as "Book a seat", so its colour
  // transitions from terracotta to green instead of being swapped out.
  if (celebrating && state.kind === 'confirmed') {
    return (
      <div role="status">
        <Button variant="success" size="lg" fullWidth className="motion-safe:animate-success-ring">
          <SuccessCheck />
          You're going!
        </Button>
      </div>
    );
  }

  switch (state.kind) {
    case 'closed':
      return <Panel tone="closed" icon={Lock} title={state.reason} />;

    case 'login':
      return (
        <div>
          <Button as={Link} to="/login" state={{ from: location }} variant="secondary" size="lg" fullWidth>
            <LogIn aria-hidden="true" />
            Log in to book a seat
          </Button>
          <Note>{event.seatsLeft > 0 ? 'It only takes a minute.' : "It's full, but you can join the waitlist."}</Note>
        </div>
      );

    case 'confirmed':
      return (
        <Panel tone="success" icon={CircleCheck} title="You're going">
          <p className="text-sm text-ink-muted">Your seat is confirmed.</p>
          <LeaveControl
            label="Cancel booking"
            confirmText={event.waitlistCount > 0 ? 'Your seat goes to the next person in line.' : 'Give up your seat?'}
            onConfirm={() => leave.mutate()}
            disabled={isPending}
          />
        </Panel>
      );

    case 'waitlisted':
      return (
        <Panel tone="warning" icon={Hourglass} title={`You're #${state.position} in line`}>
          <p className="text-sm text-ink-muted">If someone cancels, you'll get their seat automatically.</p>
          <LeaveControl
            label="Leave waitlist"
            confirmText="You'll lose your place."
            onConfirm={() => leave.mutate()}
            disabled={isPending}
          />
        </Panel>
      );

    case 'full':
      return (
        <div>
          <Button size="lg" fullWidth onClick={() => join.mutate()} disabled={isPending}>
            <Users aria-hidden="true" />
            Join waitlist
          </Button>
          <Note>
            {event.waitlistCount === 0
              ? "It's full. You'd be first in line."
              : `It's full. ${event.waitlistCount} ${event.waitlistCount === 1 ? 'person is' : 'people are'} ahead of you.`}
          </Note>
        </div>
      );

    default:
      return (
        <div role="status">
          <Button size="lg" fullWidth onClick={book} disabled={isPending}>
            <Ticket aria-hidden="true" />
            Book a seat
          </Button>
        </div>
      );
  }
}
