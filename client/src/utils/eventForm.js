// Form <-> API mapping and client-side validation for EventForm. The rules
// mirror server/src/validators/events.schemas.js so most mistakes are caught
// before submitting; the server still has the final say and its field
// errors are shown in the same places.
import { CATEGORY_LABELS } from './constants';
import { fromPuneInputValue, toPuneInputValue } from './format';

export const MAX_CAPACITY = 100000;
export const MAX_PRICE = 99999999.99;
export const MAX_DESCRIPTION = 5000;

export const EMPTY_FORM = {
  title: '',
  category: '',
  venueId: '',
  startsAt: '',
  endsAt: '',
  capacity: '',
  price: '0',
  description: '',
  status: 'published',
};

// Event from the API -> form values (all strings, as inputs expect).
export function eventToForm(event) {
  return {
    title: event.title,
    category: event.category,
    venueId: event.venue ? String(event.venue.id) : '',
    startsAt: toPuneInputValue(event.startsAt),
    endsAt: toPuneInputValue(event.endsAt),
    capacity: String(event.capacity),
    price: String(event.price),
    description: event.description ?? '',
    status: event.status === 'draft' ? 'draft' : 'published',
  };
}

// One field's form string -> the value the API expects.
const toApi = {
  title: (v) => v.trim(),
  category: (v) => v,
  venueId: (v) => (v ? Number(v) : null),
  startsAt: fromPuneInputValue,
  endsAt: fromPuneInputValue,
  capacity: (v) => Number(v),
  price: (v) => Number(v),
  description: (v) => v.trim() || null,
  status: (v) => v,
};

// POST body: every field, minus empty optional ones.
export function formToCreatePayload(values) {
  const payload = {};
  for (const [field, convert] of Object.entries(toApi)) {
    const value = convert(values[field]);
    if (value !== null) payload[field] = value;
  }
  return payload;
}

// PATCH body: only fields that differ from the original, so an unchanged
// start time in the past isn't re-sent and rejected.
export function formToUpdatePayload(values, original) {
  const changes = {};
  for (const [field, convert] of Object.entries(toApi)) {
    if (values[field] !== original[field]) changes[field] = convert(values[field]);
  }
  return changes;
}

// Returns { field: message }; empty when valid.
// context: { seatsTaken, original } for edits.
export function validateEventForm(values, { seatsTaken = 0, original } = {}) {
  const errors = {};
  const changed = (field) => !original || values[field] !== original[field];

  const title = values.title.trim();
  if (title.length < 3) errors.title = 'Title must be at least 3 characters.';
  else if (title.length > 200) errors.title = 'Title must be at most 200 characters.';

  if (!CATEGORY_LABELS[values.category]) errors.category = 'Pick a category.';

  if (!values.startsAt) {
    errors.startsAt = 'Pick a start date and time.';
  } else if (changed('startsAt') && new Date(fromPuneInputValue(values.startsAt)).getTime() <= Date.now()) {
    errors.startsAt = 'Start time must be in the future.';
  }

  if (values.endsAt && values.startsAt && values.endsAt <= values.startsAt) {
    errors.endsAt = 'End time must be after the start time.';
  }

  const capacity = Number(values.capacity);
  if (values.capacity === '' || !Number.isInteger(capacity) || capacity < 1) {
    errors.capacity = 'Capacity must be a whole number, at least 1.';
  } else if (capacity > MAX_CAPACITY) {
    errors.capacity = `Capacity can be at most ${MAX_CAPACITY.toLocaleString('en-IN')}.`;
  } else if (capacity < seatsTaken) {
    errors.capacity = `${seatsTaken} seats are already taken, so capacity can't go below that.`;
  }

  const price = Number(values.price);
  if (values.price === '' || Number.isNaN(price) || price < 0) {
    errors.price = 'Price must be 0 or more.';
  } else if (price > MAX_PRICE) {
    errors.price = 'Price is too high.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(values.price.trim())) {
    errors.price = 'Use at most 2 decimal places.';
  }

  if (values.description.trim().length > MAX_DESCRIPTION) {
    errors.description = `Description must be at most ${MAX_DESCRIPTION} characters.`;
  }

  return errors;
}

// Server error codes that belong to a specific field.
export const ERROR_CODE_FIELDS = {
  CAPACITY_BELOW_SEATS_TAKEN: 'capacity',
  INVALID_VENUE: 'venueId',
  EVENT_HAS_ATTENDEES: 'status',
};
