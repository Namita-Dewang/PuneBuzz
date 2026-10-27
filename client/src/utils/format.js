// Events are in Pune, so times are always shown in IST regardless of the
// viewer's own time zone.
const TZ = 'Asia/Kolkata';

const dayFormat = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

const partsFormat = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });

// { weekday: 'Sat', day: '7', month: 'Nov', time: '11:30 am' } for date blocks.
export function eventDateParts(iso) {
  const date = new Date(iso);
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, day: p.day, month: p.month, time: timeFormat.format(date) };
}

// "Sat, 7 Nov · 11:30 am"
export function formatEventDate(iso) {
  const date = new Date(iso);
  return `${dayFormat.format(date)} · ${timeFormat.format(date)}`;
}

// "Sat, 7 Nov 2026 · 11:30 am – 2:00 pm" (or with both dates if it spans days)
export function formatEventRange(startIso, endIso) {
  const start = new Date(startIso);
  const startText = `${dayYearFormat.format(start)} · ${timeFormat.format(start)}`;
  if (!endIso) return startText;
  const end = new Date(endIso);
  return ymdFormat.format(start) === ymdFormat.format(end)
    ? `${startText} – ${timeFormat.format(end)}`
    : `${startText} – ${dayYearFormat.format(end)} · ${timeFormat.format(end)}`;
}

// 0 -> "Free", 499 -> "₹499", 19.5 -> "₹19.50"
export function formatPrice(price) {
  if (!price) return 'Free';
  return currency.format(price).replace(/\.00$/, '');
}

// Today's date in Pune as YYYY-MM-DD, for date inputs.
export function todayInPune() {
  return ymdFormat.format(new Date());
}

// ---- Calendar ranges in Pune time, as YYYY-MM-DD strings (what the API's
// date-only `from`/`to` filters take).
function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday

// The next 7 days including today. No `from`, so the API's default
// ("starting from now") keeps already-started events out.
export function thisWeekRange() {
  return { to: addDays(todayInPune(), 6) };
}

// This Saturday + Sunday, or the rest of the weekend if it's already started.
export function weekendRange() {
  const today = todayInPune();
  const day = weekdayOf(today);
  if (day === 6) return { label: [today, addDays(today, 1)], to: addDays(today, 1) };
  if (day === 0) return { label: [today, today], to: today };
  const saturday = addDays(today, 6 - day);
  return { label: [saturday, addDays(saturday, 1)], from: saturday, to: addDays(saturday, 1) };
}

const rangeDay = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
// ['2026-10-31', '2026-11-01'] -> "Sat, 31 Oct – Sun, 1 Nov"
export function formatDayRange([from, to]) {
  const a = rangeDay.format(new Date(`${from}T00:00:00Z`));
  return from === to ? a : `${a} – ${rangeDay.format(new Date(`${to}T00:00:00Z`))}`;
}

export function hasStarted(iso) {
  return new Date(iso).getTime() <= Date.now();
}

// "7 Nov 2026, 3:04 pm", for RSVP and join times.
const shortFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
export function formatTimestamp(iso) {
  return shortFormat.format(new Date(iso));
}

// <input type="datetime-local"> has no time zone. The form treats its value
// as Pune wall-clock time, whatever zone the organizer's browser is in.
const inputParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// ISO instant -> "2026-11-05T18:30" in Pune time.
export function toPuneInputValue(iso) {
  if (!iso) return '';
  const p = Object.fromEntries(inputParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// "2026-11-05T18:30" (Pune time) -> "2026-11-05T18:30:00+05:30", which the API accepts.
export function fromPuneInputValue(value) {
  return value ? `${value}:00+05:30` : null;
}
