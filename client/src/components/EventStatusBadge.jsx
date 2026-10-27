import { hasStarted } from '../utils/format';
import { Badge } from './ui';

const KINDS = {
  cancelled: { tone: 'danger', label: 'Cancelled' },
  draft: { tone: 'neutral', label: 'Draft' },
  past: { tone: 'closed', label: 'Ended' },
};

// Shows Cancelled / Draft / Ended; nothing for a normal upcoming event.
export default function EventStatusBadge({ event }) {
  const kind = event.status === 'published' ? (hasStarted(event.startsAt) ? 'past' : null) : event.status;
  if (!kind) return null;
  return <Badge tone={KINDS[kind].tone}>{KINDS[kind].label}</Badge>;
}
