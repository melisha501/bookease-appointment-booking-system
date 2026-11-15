// Sidebar — left navigation for DASHBOARD pages (Customer & Admin).
// Desktop: fixed dark panel. Mobile: slide-in drawer with a dark backdrop.

import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({
  items = [],
  isOpen = false,
  onClose = () => {},
  roleLabel = 'Dashboard',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const nav = (isMobile) => (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Logo variant="dark" subtitle={roleLabel} onClick={isMobile ? onClose : undefined} />
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dashboard menu"
            className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label={roleLabel}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || false}
              onClick={isMobile ? onClose : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition duration-200 ${
                  isActive
                    ? 'bg-teal-brand/15 text-white ring-1 ring-teal-glow/20'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {Icon ? (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                        isActive ? 'bg-teal-brand text-white' : 'bg-white/5 text-white/70 group-hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          to="/"
          onClick={isMobile ? onClose : undefined}
          className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3.5 py-3 text-xs font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          Back to website
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink md:flex">
        {nav(false)}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={`${roleLabel} menu`}>
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col bg-ink shadow-pop animate-fade-up">
            {nav(true)}
          </aside>
        </div>
      ) : null}
    </>
  );
}
