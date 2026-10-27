import cx from '../utils/cx';

// Seats taken vs capacity, plus the waitlist length.
export default function SeatMeter({ capacity, seatsTaken, seatsLeft, waitlistCount = 0 }) {
  const percent = capacity > 0 ? Math.min(100, Math.round((seatsTaken / capacity) * 100)) : 0;
  const full = seatsLeft <= 0;
  const few = !full && seatsLeft <= Math.max(3, Math.ceil(capacity * 0.1));
  const barColor = full ? 'bg-warning' : few ? 'bg-accent' : 'bg-success';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cx('text-sm font-semibold', full ? 'text-warning' : 'text-ink')}>
          {full ? 'Fully booked' : `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`}
        </p>
        <p className="text-xs tabular-nums text-ink-muted">
          {seatsTaken} / {capacity} taken
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Seats taken"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={seatsTaken}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <div className={cx('h-full rounded-full', barColor)} style={{ width: `${percent}%` }} />
      </div>
      {waitlistCount > 0 && (
        <p className="mt-2.5 text-xs text-ink-muted">
          {waitlistCount} {waitlistCount === 1 ? 'person' : 'people'} on the waitlist
        </p>
      )}
    </div>
  );
}
