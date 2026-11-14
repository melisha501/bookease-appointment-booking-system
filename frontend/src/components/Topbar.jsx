// Topbar — top bar inside DASHBOARD pages. Shows title, user chip + Logout.
// Uses the authenticated backend session.

import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../store/DemoContext';

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

  const initials = displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-[4.25rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open dashboard menu"
          className="inline-flex items-center justify-center rounded-lg p-2 text-ink hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-ink sm:text-lg">{title}</h1>
          {subtitle && <p className="hidden truncate text-xs text-ink-soft sm:block">{subtitle}</p>}
        </div>

        <div className="ml-auto hidden items-center lg:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search"
              className="input-modern w-64 rounded-full py-2 pr-4 pl-9"
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative ml-auto rounded-full p-2 text-ink-soft hover:bg-slate-100 hover:text-ink lg:ml-3"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-brand ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white">{initials}</span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[10rem] truncate text-sm leading-tight font-semibold text-ink">{displayName}</span>
            <span className="block text-xs text-ink-soft">{roleLabel}</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100"
            aria-label="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
