import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CATEGORY_LABELS } from '../utils/constants';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const FILTER_KEYS = ['q', 'category', 'area', 'from', 'to', 'free'];

// Reads filters from the URL, dropping anything the API would reject, so a
// hand-edited or stale link degrades to "fewer filters" instead of an error.
function parseFilters(params) {
  const filters = {};

  const q = params.get('q')?.trim().slice(0, 100);
  if (q) filters.q = q;

  const category = params.get('category');
  if (category && CATEGORY_LABELS[category]) filters.category = category;

  const area = params.get('area')?.trim();
  if (area) filters.area = area;

  const from = params.get('from');
  if (from && DATE_ONLY.test(from)) filters.from = from;
  const to = params.get('to');
  if (to && DATE_ONLY.test(to) && (!filters.from || to >= filters.from)) filters.to = to;

  const free = params.get('free');
  if (free === 'true' || free === 'false') filters.free = free;

  const page = Number(params.get('page'));
  filters.page = Number.isInteger(page) && page > 1 ? page : 1;

  return filters;
}

// The URL query string is the single source of truth for Browse filters, so
// a filtered list can be shared, bookmarked, and walked with Back/Forward.
export default function useEventFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // patch: { key: value | '' | undefined }. Any filter change returns to page 1.
  // replace: true for keystroke-driven updates so typing doesn't flood history.
  const setFilters = useCallback(
    (patch, { replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '' || (key === 'page' && value === 1)) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => setSearchParams({}), [setSearchParams]);

  const activeCount = FILTER_KEYS.filter((key) => filters[key] !== undefined).length;

  return { filters, setFilters, clearFilters, activeCount };
}
