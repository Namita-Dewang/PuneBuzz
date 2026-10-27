import { useState } from 'react';
import { HandHeart, RotateCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { CategoryChips, MoreFilters, SearchBar } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ApplyModal from '../components/volunteer/ApplyModal';
import VolunteerEventCard, { VolunteerEventCardSkeleton } from '../components/volunteer/VolunteerEventCard';
import { Button, EmptyState, Eyebrow, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useEventFilters from '../hooks/useEventFilters';
import { useOpportunities } from '../hooks/useVolunteer';
import { getErrorMessage } from '../utils/apiError';
import cx from '../utils/cx';

const gridClass = 'grid gap-6 lg:grid-cols-2';

export default function VolunteerPage() {
  const { filters, setFilters, clearFilters, activeCount } = useEventFilters();
  const { data, isPending, isError, error, isPlaceholderData, refetch } = useOpportunities(filters);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [target, setTarget] = useState(null);

  // Logged-out visitors can browse; applying sends them to log in first.
  function openApply(next) {
    if (!user) navigate('/login', { state: { from: location } });
    else setTarget(next);
  }

  let results;
  if (isPending) {
    results = (
      <div className={gridClass} aria-busy="true" aria-label="Loading volunteer opportunities">
        {[1, 2, 3, 4].map((i) => <VolunteerEventCardSkeleton key={i} />)}
      </div>
    );
  } else if (isError) {
    results = (
      <EmptyState icon="alert" title="Couldn't load volunteer opportunities" message={getErrorMessage(error)}
        action={<Button variant="secondary" onClick={() => refetch()}><RotateCw aria-hidden="true" />Try again</Button>} />
    );
  } else if (data.data.length === 0) {
    results = activeCount > 0 ? (
      <EmptyState icon="search" title="No matches" message="No events with open volunteer roles match these filters."
        action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
    ) : (
      <EmptyState title="No events need volunteers right now — check back soon"
        action={<Button variant="secondary" onClick={() => refetch()}><RotateCw aria-hidden="true" />Refresh</Button>} />
    );
  } else {
    results = (
      <>
        <div className={cx(gridClass, isPlaceholderData && 'opacity-60')}>
          {data.data.map((event) => <VolunteerEventCard key={event.id} event={event} onApply={openApply} />)}
        </div>
        <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={(page) => setFilters({ page })} />
      </>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <PageHeader
        size="display"
        eyebrow={<Eyebrow className="flex items-center gap-2"><HandHeart className="size-4" aria-hidden="true" />Want to volunteer</Eyebrow>}
        title="Lend a hand"
        description="Events across Pune looking for volunteers"
      />
      <div className="mt-8 max-w-2xl">
        <SearchBar filters={filters} onChange={setFilters} />
      </div>
      <div className="mt-8 space-y-5 border-y border-line py-6">
        <CategoryChips filters={filters} onChange={setFilters} />
        <MoreFilters filters={filters} onChange={setFilters} onClear={clearFilters} activeCount={activeCount} showPrice={false} />
      </div>
      <section aria-label="Volunteer opportunities" className="mt-10 space-y-8">{results}</section>
      <ApplyModal target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
