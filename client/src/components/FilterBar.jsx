import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAreas } from '../hooks/useVenues';
import cx from '../utils/cx';
import { CATEGORIES, CATEGORY_ICONS, categoryTheme } from '../utils/constants';
import { todayInPune } from '../utils/format';
import { Button, Field, Input, Select } from './ui';

// All three pieces read and write filters through useEventFilters (the URL):
// filters / onChange(patch, options) / onClear.

const SEARCH_DEBOUNCE_MS = 300;

// Big search box for the hero. Typing goes to local state and is pushed to
// the URL after a pause.
export function SearchBar({ filters, onChange }) {
  const [search, setSearch] = useState(filters.q ?? '');
  useEffect(() => {
    setSearch(filters.q ?? ''); // follow Back/Forward and "Clear filters"
  }, [filters.q]);
  useEffect(() => {
    if (search.trim() === (filters.q ?? '')) return undefined;
    const timer = setTimeout(() => onChange({ q: search.trim() }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters.q, onChange]);

  return (
    <div role="search">
      <label htmlFor="filter-q" className="sr-only">
        Search events
      </label>
      <Input
        id="filter-q"
        type="search"
        value={search}
        maxLength={100}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search events, e.g. trek, jazz, pottery"
        leading={<Search className="size-5" aria-hidden="true" />}
        className="h-14 rounded-2xl pl-12 text-base shadow-lift"
      />
    </div>
  );
}

// Pill-style category chips with icons, each in its category's colour.
// "All" clears the category. On narrow screens the row scrolls sideways,
// with a fade on the right edge hinting there's more.
export function CategoryChips({ filters, onChange }) {
  const chips = [{ value: '', label: 'All' }, ...CATEGORIES];
  return (
    <div className="-mx-4 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:mx-0 sm:[mask-image:none]">
      <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto px-4 pb-1 pr-10 sm:flex-wrap sm:px-0 sm:pr-0">
        {chips.map((chip) => {
          const active = (filters.category ?? '') === chip.value;
          const theme = categoryTheme(chip.value);
          const Icon = CATEGORY_ICONS[chip.value || 'all'];
          return (
            <button
              key={chip.label}
              id={`category-${chip.value || 'all'}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ category: chip.value })}
              className={cx(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150',
                active ? theme.chip : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink'
              )}
            >
              <Icon className={cx('size-4', !active && theme.text)} aria-hidden="true" />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PRICE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Free' },
  { value: 'false', label: 'Paid' },
];

// Area, dates and price, plus "Clear filters".
export function MoreFilters({ filters, onChange, onClear, activeCount, showPrice = true }) {
  const { areas } = useAreas();
  // A stale shared link can name an area that has no venues any more; keep it selectable.
  const areaOptions = filters.area && !areas.includes(filters.area) ? [filters.area, ...areas] : areas;

  return (
    // Two columns up to tablet width (area + price, then the dates); one row of five from lg.
    <div className={cx('grid grid-cols-2 items-end gap-3', showPrice ? 'lg:grid-cols-[1.2fr_1fr_1fr_1.1fr_auto]' : 'lg:grid-cols-[1.2fr_1fr_1fr_auto]')}>
      <Field name="filter-area" label="Area" size="sm" className={showPrice ? '' : 'col-span-2 lg:col-span-1'}>
        {(p) => (
          <Select id={p.id} value={filters.area ?? ''} onChange={(e) => onChange({ area: e.target.value })}>
            <option value="">All areas</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="col-span-2 grid grid-cols-2 gap-3 lg:contents">
        <Field name="filter-from" label="From" size="sm">
          {(p) => (
            <Input
              id={p.id}
              type="date"
              value={filters.from ?? ''}
              min={todayInPune()}
              onChange={(e) => {
                const from = e.target.value;
                // Drop an end date that would now be before the start.
                onChange(filters.to && from && filters.to < from ? { from, to: '' } : { from });
              }}
            />
          )}
        </Field>
        <Field name="filter-to" label="To" size="sm">
          {(p) => (
            <Input
              id={p.id}
              type="date"
              value={filters.to ?? ''}
              min={filters.from ?? todayInPune()}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          )}
        </Field>
      </div>

      {showPrice && (<div className="col-start-2 row-start-1 lg:col-auto lg:row-auto">
        <p className="mb-1 text-xs font-medium text-ink-muted">Price</p>
        <div role="group" aria-label="Price" className="grid h-[2.875rem] grid-cols-3 gap-1 rounded-xl border border-line-strong bg-sunken p-1">
          {PRICE_OPTIONS.map((option) => {
            const active = (filters.free ?? '') === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ free: option.value })}
                className={cx(
                  'rounded-lg text-sm font-medium transition-colors duration-150',
                  active ? 'bg-surface text-ink shadow-soft' : 'text-ink-muted hover:text-ink'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>)}

      <div className="col-span-2 flex justify-end empty:hidden lg:col-span-1">
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-[2.875rem] text-accent hover:text-accent-hover">
            <X aria-hidden="true" />
            Clear filters ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
