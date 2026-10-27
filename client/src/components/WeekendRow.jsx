import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWeekendEvents } from '../hooks/useEventHighlights';
import { formatDayRange } from '../utils/format';
import { FeatureCard, FeatureCardSkeleton } from './EventCard';
import { Eyebrow, SectionHeader } from './ui';

function ArrowButton({ direction, disabled, onClick }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Scroll weekend events left' : 'Scroll weekend events right'}
      className="hidden size-10 place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors duration-150 hover:bg-sunken disabled:opacity-35 sm:grid"
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}

// "This weekend": a horizontally scrolling row of larger feature cards.
// Hidden when nothing is on (and while the user is filtering; see HomePage).
export default function WeekendRow() {
  const { data, isPending, isError, days } = useWeekendEvents();
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false, overflows: false });

  function updateEdges() {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      overflows: el.scrollWidth > el.clientWidth + 4, // arrows only when there is something to scroll to
    });
  }
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [data]);

  function scrollByCard(direction) {
    const el = scroller.current;
    const card = el?.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + 20; // card + gap
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  if (isError || (!isPending && data.data.length === 0)) return null;

  return (
    <section aria-labelledby="weekend-heading" className="mt-12 sm:mt-14">
      <SectionHeader
        title={
          <span id="weekend-heading" className="flex flex-col gap-2">
            <Eyebrow>This weekend</Eyebrow>
            <span className="tabular-nums">{formatDayRange(days)}</span>
          </span>
        }
        description={!isPending && `${data.total} ${data.total === 1 ? 'event' : 'events'} on Saturday and Sunday`}
        actions={
          !isPending && edges.overflows && (
            <>
              <ArrowButton direction="left" disabled={edges.start} onClick={() => scrollByCard(-1)} />
              <ArrowButton direction="right" disabled={edges.end} onClick={() => scrollByCard(1)} />
            </>
          )
        }
      />
      <div
        ref={scroller}
        onScroll={updateEdges}
        aria-busy={isPending}
        className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6"
      >
        {isPending
          ? Array.from({ length: 3 }, (_, i) => <FeatureCardSkeleton key={i} />)
          : data.data.map((event) => <FeatureCard key={event.id} event={event} />)}
      </div>
    </section>
  );
}
