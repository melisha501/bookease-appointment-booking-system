// Navbar — top bar for PUBLIC pages. Auth-aware:
// - Logged out: Login / Register
// - Logged in: Dashboard + Logout + user name (real backend session)

import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CalendarCheck, Menu, X } from 'lucide-react';
import { useDemo } from '../store/DemoContext';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Specialists', to: '/specialists' },
  { label: 'Booking', to: '/booking' },
];

function linkClassName({ isActive }) {
  return `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? 'bg-teal-50 text-teal-deep shadow-[inset_0_0_0_1px_rgba(20,184,166,0.12)]'
      : 'text-ink-soft hover:bg-slate-100/80 hover:text-ink'
  }`;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn, user, isAdmin, logout } = useDemo();
  const navigate = useNavigate();
  const dashboardTo = isAdmin ? '/admin' : '/customer';

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-brand to-teal-deep text-white shadow-[0_10px_24px_-14px_rgba(15,118,110,0.8)] transition-transform duration-200 group-hover:scale-[1.02]">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-ink">BookEase</span>
            <span className="block text-[11px] font-medium tracking-wide text-ink-soft uppercase">
              Service Booking
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <>
              <span className="hidden max-w-[12rem] truncate text-sm font-medium text-ink lg:block">{user?.name}</span>
              <Link to={dashboardTo} className="rounded-full px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-100">
                Dashboard
              </Link>
              <button type="button" onClick={handleLogout} className="rounded-full bg-teal-deep px-5 py-2 text-sm font-semibold text-white hover:bg-teal-brand">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-100">
                Login
              </Link>
              <Link to="/register" className="rounded-full bg-teal-deep px-5 py-2 text-sm font-semibold text-white hover:bg-teal-brand">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-ink hover:bg-slate-100 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-line bg-white px-4 pt-2 pb-4 md:hidden" aria-label="Mobile">
          <div className="space-y-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-4 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-teal-50 font-semibold text-teal-deep' : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-4">
            {isLoggedIn ? (
              <div className="flex gap-3">
                <Link to={dashboardTo} onClick={() => setOpen(false)} className="flex-1 rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold text-ink">
                  Dashboard
                </Link>
                <button type="button" onClick={handleLogout} className="flex-1 rounded-full bg-teal-deep px-4 py-2.5 text-center text-sm font-semibold text-white">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link to="/login" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold text-ink">
                  Login
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-teal-deep px-4 py-2.5 text-center text-sm font-semibold text-white">
                  Register
                </Link>
              </div>
            )}
            {isLoggedIn ? (
              <p className="text-center text-xs text-ink-soft">Signed in with your account.</p>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  );
}
