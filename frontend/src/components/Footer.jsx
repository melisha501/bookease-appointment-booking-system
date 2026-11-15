// Footer — bottom section for PUBLIC pages.

import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import Logo from './Logo';

const CURRENT_YEAR = new Date().getFullYear();

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Specialists', to: '/specialists' },
  { label: 'Book appointment', to: '/booking' },
];

const accountLinks = [
  { label: 'Login', to: '/login' },
  { label: 'Create account', to: '/register' },
  { label: 'My appointments', to: '/customer/appointments' },
  { label: 'My profile', to: '/customer/profile' },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'radial-gradient(640px 300px at 8% 0%, rgba(20,184,166,0.18), transparent 62%), radial-gradient(520px 260px at 92% 10%, rgba(45,212,191,0.1), transparent 58%)',
        }}
        aria-hidden="true"
      />
      <div className="container-page relative py-14 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo variant="dark" subtitle="Appointment booking" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Book trusted specialists in minutes. A calmer way to schedule clinics,
              salons, consultancies, and training sessions.
            </p>
            <Link
              to="/booking"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              Book an appointment
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <nav aria-label="Explore">
            <h3 className="text-xs font-bold tracking-[0.16em] text-white/45 uppercase">Explore</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-white/70 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h3 className="text-xs font-bold tracking-[0.16em] text-white/45 uppercase">Account</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {accountLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-white/70 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-xs font-bold tracking-[0.16em] text-white/45 uppercase">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-glow" aria-hidden="true" />
                Kathmandu, Nepal
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-teal-glow" aria-hidden="true" />
                <a href="tel:+97714000000" className="transition hover:text-white">
                  +977-1-4000000
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-teal-glow" aria-hidden="true" />
                <a href="mailto:hello@bookease.com.np" className="break-all transition hover:text-white">
                  hello@bookease.com.np
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-glow" aria-hidden="true" />
                Mon–Sat, 9:00 AM – 8:00 PM
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} BookEase. All rights reserved.</p>
          <p>Made for simpler scheduling.</p>
        </div>
      </div>
    </footer>
  );
}
