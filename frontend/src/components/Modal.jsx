// Modal — accessible, portal-rendered dialog used for confirmations and
// booking success. Rendered into document.body so parent transforms never
// clip the overlay.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  hideClose = false,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Dialog'}
    >
      <div
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full ${sizes[size] || sizes.md} max-h-[92vh] overflow-y-auto rounded-t-3xl border border-white/70 bg-white shadow-pop animate-scale-in sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/80 px-6 py-5">
          <div className="min-w-0">
            {title ? <h2 className="text-h3">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
          </div>
          {!hideClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1 -mt-1 shrink-0 rounded-xl p-2 text-ink-soft transition hover:bg-slate-100 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line/80 bg-surface/60 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
