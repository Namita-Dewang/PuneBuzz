import { useEffect, useRef } from 'react';
import cx from '../../utils/cx';

const SIZES = { md: 'max-w-md', lg: 'max-w-xl' };

/**
 * Modal built on the native <dialog>: focus trapping, Escape to close and an
 * inert background for free.
 *   <Modal open title="…" description="…" onClose={…} actions={<Button …/>} size="md|lg">body</Modal>
 * While `pending`, Escape and backdrop clicks are ignored so an in-flight
 * action can't be hidden. Tall content scrolls inside the dialog.
 */
export default function Modal({ open, title, description, children, actions, pending = false, size = 'md', onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !pending) onClose(); // click on the backdrop
      }}
      aria-labelledby="modal-title"
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        SIZES[size]
      )}
    >
      <div className="p-6 sm:p-7">
        <h2 id="modal-title" className="font-display text-heading font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
        <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-muted">{children}</div>
        {actions && <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </dialog>
  );
}
