import { useState } from 'react';
import { Link } from 'react-router';
import { getErrorCode, getErrorMessage, getFieldErrors } from '../utils/apiError';
import { CATEGORIES } from '../utils/constants';
import { ERROR_CODE_FIELDS, MAX_DESCRIPTION, validateEventForm } from '../utils/eventForm';
import { todayInPune } from '../utils/format';
import ChoiceField from './ChoiceField';
import VenueSelect from './VenueSelect';
import { Button, Card, Field, Input, Select, Textarea } from './ui';

function Section({ title, description, children }) {
  return (
    <Card padding="lg">
      <div className="mb-6">
        <h2 className="font-display text-heading font-medium text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

// Shared by /events/new and /events/:id/edit.
// - initialValues: form strings (EMPTY_FORM or eventToForm(event))
// - event: the existing event when editing (seat counts drive extra rules)
// - onSubmit(values): returns a promise; throw the Axios error to show it here
export default function EventForm({ initialValues, event, submitLabel, cancelTo, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const seatsTaken = event?.seatsTaken ?? 0;
  const hasPeople = Boolean(event && (event.seatsTaken > 0 || event.waitlistCount > 0));
  const isEdit = Boolean(event);

  // Client checks show after the first submit attempt, then update live.
  const clientErrors = submitted ? validateEventForm(values, { seatsTaken, original: isEdit ? initialValues : undefined }) : {};
  const serverFields = getFieldErrors(serverError);
  const codeField = ERROR_CODE_FIELDS[getErrorCode(serverError)];
  if (codeField) serverFields[codeField] = getErrorMessage(serverError);
  const errors = { ...serverFields, ...clientErrors };
  const generalError = serverError && !Object.keys(serverFields).length ? getErrorMessage(serverError) : null;

  function set(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
      setServerError(null); // stale once the user edits
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    const problems = validateEventForm(values, { seatsTaken, original: isEdit ? initialValues : undefined });
    if (Object.keys(problems).length) {
      document.getElementById(Object.keys(problems)[0])?.focus();
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setServerError(err);
      setSaving(false);
    }
  }

  const capacityHint = isEdit
    ? `${seatsTaken} ${seatsTaken === 1 ? 'seat is' : 'seats are'} taken.${
        event.waitlistCount > 0 ? ` Raising capacity moves people off the waitlist (${event.waitlistCount} waiting).` : ''
      }`
    : 'How many people can attend.';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Section title="The basics" description="What it is and where it happens.">
        <Field name="title" label="Title" error={errors.title}>
          {(p) => <Input {...p} invalid={Boolean(errors.title)} value={values.title} onChange={set('title')} maxLength={200} />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="category" label="Category" error={errors.category}>
            {(p) => (
              <Select {...p} invalid={Boolean(errors.category)} value={values.category} onChange={set('category')}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            )}
          </Field>

          <Field name="venueId" label="Venue" error={errors.venueId}>
            {(p) => <VenueSelect controlProps={p} value={values.venueId} onChange={set('venueId')} error={errors.venueId} />}
          </Field>
        </div>

        <Field
          name="description"
          label="Description"
          optional
          error={errors.description}
          hint={`${values.description.length} / ${MAX_DESCRIPTION}`}
        >
          {(p) => (
            <Textarea
              {...p}
              invalid={Boolean(errors.description)}
              value={values.description}
              onChange={set('description')}
              placeholder="What should people expect? What should they bring?"
            />
          )}
        </Field>
      </Section>

      <Section title="When" description="Times are in Pune time (IST).">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="startsAt" label="Starts" error={errors.startsAt}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                invalid={Boolean(errors.startsAt)}
                value={values.startsAt}
                min={`${todayInPune()}T00:00`}
                onChange={set('startsAt')}
              />
            )}
          </Field>
          <Field name="endsAt" label="Ends" optional error={errors.endsAt}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                invalid={Boolean(errors.endsAt)}
                value={values.endsAt}
                min={values.startsAt || undefined}
                onChange={set('endsAt')}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Seats and price">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="capacity" label="Capacity" error={errors.capacity} hint={capacityHint}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                invalid={Boolean(errors.capacity)}
                min={Math.max(1, seatsTaken)}
                step={1}
                value={values.capacity}
                onChange={set('capacity')}
              />
            )}
          </Field>
          <Field name="price" label="Price (₹)" error={errors.price} hint="0 for a free event. Payment is handled at the venue.">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                invalid={Boolean(errors.price)}
                min={0}
                step="0.01"
                value={values.price}
                onChange={set('price')}
              />
            )}
          </Field>
        </div>

        <ChoiceField
          name="status"
          label="Visibility"
          columns={2}
          value={values.status}
          onChange={set('status')}
          error={errors.status}
          options={[
            { value: 'published', label: 'Published', description: 'Listed and open for bookings.' },
            {
              value: 'draft',
              label: 'Draft',
              description: hasPeople ? "Can't unpublish: people have already joined." : 'Only you can see it.',
              disabled: hasPeople && initialValues.status === 'published',
            },
          ]}
        />
      </Section>

      {generalError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">{generalError}</p>
      )}
      {submitted && Object.keys(clientErrors).length > 0 && (
        <p role="alert" className="text-sm text-danger">Please fix the highlighted fields.</p>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button as={Link} to={cancelTo} variant="secondary" size="lg">
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
