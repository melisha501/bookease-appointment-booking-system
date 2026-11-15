// Navbar — top bar for PUBLIC pages. Auth-aware and fully responsive:
// - Logged out: Login / Register
// - Logged in: Dashboard + Logout + user name (real backend session)

import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Logo from './Logo';
import Button from './Button';
import { useDemo } from '../store/DemoContext';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Specialists', to: '/specialists' },
  { label: 'Booking', to: '/booking' },
];

function navLinkClass({ isActive }) {
  return `rounded-xl px-3.5 py-2 text-sm font-semibold transition duration-200 ${
    isActive
      ? 'bg-teal-50 text-teal-deep'
      : 'text-ink-soft hover:bg-slate-100/80 hover:text-ink'
  }`;
}

function initials(name) {
  return String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn, user, isAdmin, logout } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardTo = isAdmin ? '/admin' : '/customer';

  // Close the drawer whenever the route changes (including back/forward).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Logo onClick={() => setOpen(false)} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-2.5 md:flex">
          {isLoggedIn ? (
            <>
              <NavLink
                to={dashboardTo}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-slate-100 hover:text-ink"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-teal-deep ring-1 ring-teal-100">
                  {initials(user?.name)}
                </span>
                <span className="hidden max-w-[9rem] truncate lg:block">{user?.name || 'Dashboard'}</span>
                <LayoutDashboard className="h-4 w-4 lg:hidden" aria-hidden="true" />
              </NavLink>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm">
                Login
              </Button>
              <Button to="/register" size="sm">
                Create account
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button to="/booking" size="sm" className="hidden sm:inline-flex">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Book
          </Button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition hover:bg-slate-100"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 top-[4.5rem] z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-menu"
            className="relative max-h-[calc(100vh-4.5rem)] overflow-y-auto border-t border-line bg-white px-4 pt-4 pb-8 shadow-pop animate-fade-up safe-bottom"
            aria-label="Mobile"
          >
            <div className="space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-teal-50 text-teal-deep'
                        : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              {isLoggedIn ? (
                <>
                  <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-bold text-teal-deep ring-1 ring-line">
                      {initials(user?.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                      <p className="truncate text-xs text-ink-soft">{user?.email}</p>
                    </div>
                  </div>
                  <Button to={dashboardTo} fullWidth onClick={() => setOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Go to dashboard
                  </Button>
                  <Button variant="secondary" fullWidth onClick={handleLogout}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="secondary" fullWidth onClick={() => setOpen(false)}>
                    Login
                  </Button>
                  <Button to="/register" fullWidth onClick={() => setOpen(false)}>
                    Create account
                  </Button>
                </>
              )}
              <Button to="/booking" variant="soft" fullWidth onClick={() => setOpen(false)}>
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Book an appointment
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
