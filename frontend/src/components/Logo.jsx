// Logo — consistent BookEase brand lockup for light and dark surfaces.

import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';

export default function Logo({ to = '/', variant = 'light', compact = false, subtitle = 'Service Booking', onClick }) {
  const dark = variant === 'dark';
  return (
    <Link to={to} onClick={onClick} className="group flex items-center gap-2.5" aria-label="BookEase home">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[0_12px_26px_-16px_rgba(15,118,110,0.9)] transition duration-200 group-hover:scale-[1.03] ${
          dark ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-teal-deep text-white'
        }`}
      >
        <CalendarCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className={`block font-display text-[15px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
            BookEase
          </span>
          <span
            className={`block text-[10px] font-semibold tracking-[0.14em] uppercase ${
              dark ? 'text-white/55' : 'text-ink-soft'
            }`}
          >
            {subtitle}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
