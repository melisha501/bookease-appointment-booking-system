// Topbar — top bar inside DASHBOARD pages. Shows page title, user chip and Logout.
// The old decorative search box and notification bell were removed because they
// were not connected to any functionality.

import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../store/DemoContext';
import { loginForRole } from '../utils/authRoutes';

function initials(name) {
  return String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function Topbar({
  title = 'Dashboard',
  subtitle = '',
  userName,
  roleLabel = 'Customer',
  onMenuClick = () => {},
}) {
  const { user, logout } = useDemo();
  const navigate = useNavigate();

  const displayName = userName || user?.name || 'User';

  const handleLogout = async () => {
    const loginTo = loginForRole(user?.role);
    await logout();
    navigate(loginTo, { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-xl">
      <div className="flex h-[4.25rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open dashboard menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold tracking-tight text-ink sm:text-lg">
            {title}
          </h1>
          {subtitle ? (
            <p className="hidden truncate text-xs text-ink-soft sm:block">{subtitle}</p>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-2 py-1.5 sm:pr-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[11px] font-bold text-teal-deep ring-1 ring-teal-100">
              {initials(displayName)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[10rem] truncate text-[13px] leading-tight font-bold text-ink">
                {displayName}
              </span>
              <span className="block text-[11px] leading-tight text-ink-soft">{roleLabel}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
