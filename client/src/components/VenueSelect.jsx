import { useState } from 'react';
import { useCreateVenue, useAreas } from '../hooks/useVenues';
import { getErrorMessage, getFieldErrors } from '../utils/apiError';
import { Button, Field, Input, Select } from './ui';

const ADD_NEW = '__new__';

// Venue picker grouped by area, with an inline "add a new venue" form.
// value / onChange use the venue id as a string ('' = no venue yet).
export default function VenueSelect({ value, onChange, error, controlProps }) {
  const { data: venues = [], areas, isPending } = useAreas();
  const createVenue = useCreateVenue();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', area: '', address: '' });

  const [localErrors, setLocalErrors] = useState({});

  const byArea = areas.map((area) => ({ area, venues: venues.filter((v) => v.area === area) }));
  const newVenueErrors = { ...getFieldErrors(createVenue.error), ...localErrors };

  async function saveVenue() {
    const problems = {};
    if (draft.name.trim().length < 2) problems.name = 'Venue name must be at least 2 characters.';
    if (draft.area.trim().length < 2) problems.area = 'Area is required, e.g. Baner.';
    setLocalErrors(problems);
    if (Object.keys(problems).length) return;

    const venue = await createVenue.mutateAsync({
      name: draft.name.trim(),
      area: draft.area.trim(),
      ...(draft.address.trim() && { address: draft.address.trim() }),
    });
    onChange(String(venue.id));
    setAdding(false);
    setDraft({ name: '', area: '', address: '' });
  }

  return (
    <div>
      <Select
        {...controlProps}
        invalid={Boolean(error)}
        value={adding ? ADD_NEW : value}
        disabled={isPending}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) {
            setAdding(true);
          } else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{isPending ? 'Loading venues…' : 'Venue to be announced'}</option>
        {byArea.map(({ area, venues: inArea }) => (
          <optgroup key={area} label={area}>
            {inArea.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={ADD_NEW}>+ Add a new venue…</option>
      </Select>

      {adding && (
        // A <div>, not a nested <form>, which HTML doesn't allow.
        <div
          className="mt-3 space-y-4 rounded-xl border border-line bg-sunken/60 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
              e.preventDefault(); // don't submit the whole event form
              saveVenue().catch(() => {});
            }
          }}
        >
          <p className="font-display text-base font-medium text-ink">New venue</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="venue-name" label="Name" size="sm" error={newVenueErrors.name}>
              {(p) => (
                <Input {...p} invalid={Boolean(newVenueErrors.name)} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              )}
            </Field>
            <Field name="venue-area" label="Area" size="sm" error={newVenueErrors.area}>
              {(p) => (
                <>
                  <Input
                    {...p}
                    invalid={Boolean(newVenueErrors.area)}
                    list="venue-area-options"
                    placeholder="e.g. Baner"
                    value={draft.area}
                    onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))}
                  />
                  <datalist id="venue-area-options">
                    {areas.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </div>
          <Field name="venue-address" label="Address" size="sm" optional error={newVenueErrors.address}>
            {(p) => (
              <Input
                {...p}
                invalid={Boolean(newVenueErrors.address)}
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              />
            )}
          </Field>
          {createVenue.isError && !Object.keys(newVenueErrors).length && (
            <p role="alert" className="text-[13px] text-danger">{getErrorMessage(createVenue.error)}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveVenue().catch(() => {})} loading={createVenue.isPending}>
              {createVenue.isPending ? 'Saving…' : 'Save venue'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setLocalErrors({});
                createVenue.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
