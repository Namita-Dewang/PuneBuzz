import { useState } from 'react';
import { HandHeart } from 'lucide-react';
import { useWithdraw } from '../../hooks/useVolunteer';
import cx from '../../utils/cx';
import { Badge, Button } from '../ui';

export const STATUS_BADGE = {
  pending: { tone: 'warning', label: 'Pending' },
  accepted: { tone: 'success', label: 'Volunteering' },
  declined: { tone: 'closed', label: 'Not selected' },
};

// Two-step withdraw so a stray tap can't drop an application.
function Withdraw({ roleId }) {
  const withdraw = useWithdraw();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded text-[13px] font-medium text-ink-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline"
      >
        Withdraw
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Button size="sm" variant="danger-outline" loading={withdraw.isPending} onClick={() => withdraw.mutate({ roleId })}>
        Withdraw?
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  );
}

// One volunteer role: title, description, spots left, and either an Apply
// button or the viewer's application status.
//   canApply: false hides the action (event closed / it's the organizer)
export default function RoleRow({ role, canApply = true, onApply, className = '' }) {
  const status = role.myStatus ? STATUS_BADGE[role.myStatus] : null;
  const full = role.spotsLeft <= 0;
  return (
    <li className={cx('flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6', className)}>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{role.title}</p>
        {role.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{role.description}</p>}
        <p className={cx('mt-1 text-[13px] font-medium tabular-nums', full ? 'text-ink-subtle' : 'text-accent')}>
          {full ? 'All spots filled' : `${role.spotsLeft} ${role.spotsLeft === 1 ? 'spot' : 'spots'} left`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {status ? (
          <>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {canApply && role.myStatus !== 'declined' && <Withdraw roleId={role.id} />}
          </>
        ) : (
          canApply && !full && (
            <Button size="sm" variant="secondary" onClick={() => onApply(role)}>
              <HandHeart aria-hidden="true" />
              Apply
            </Button>
          )
        )}
      </div>
    </li>
  );
}
