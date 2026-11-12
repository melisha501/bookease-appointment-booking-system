// Sidebar — left navigation for DASHBOARD pages (Customer & Admin).
// Pure UI component. It receives the menu from DashboardLayout, so the same
// component works for both dashboards with different items.
//
// Desktop: fixed left panel (always visible on md+).
// Mobile: slide-in drawer with a dark backdrop (open/close via props).

import { NavLink } from 'react-router-dom';
import { CalendarCheck, X } from 'lucide-react';

export default function Sidebar({
  items = [],
  isOpen = false,
  onClose = () => {},
  roleLabel = 'Dashboard',
}) {
  const nav = (isMobile) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-deep text-white">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-ink">
              BookEase
            </span>
            <span className="block text-[11px] font-medium tracking-wide text-ink-soft uppercase">
              {roleLabel}
            </span>
          </span>
        </div>

        {/* Close button — mobile only */}
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dashboard menu"
            className="rounded-lg p-2 text-ink hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label={roleLabel}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || false}
              onClick={isMobile ? onClose : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-50 font-semibold text-teal-deep'
                    : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
                }`
              }
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" />}
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom note */}
      <div className="p-5">
        <p className="rounded-2xl border border-line bg-gradient-to-br from-teal-50/60 to-white px-4 py-3 text-xs leading-relaxed text-ink-soft">
          Signed in with your real account. Manage bookings and records from this dashboard.
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-white md:flex">
        {nav(false)}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Panel */}
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-white shadow-xl">
            {nav(true)}
          </aside>
        </div>
      )}
    </>
  );
}
