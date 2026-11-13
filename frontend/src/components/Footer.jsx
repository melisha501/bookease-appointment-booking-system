// Footer — bottom section for PUBLIC pages.
// Used inside PublicLayout. Pure UI — links point to pages being built next.

import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, Mail, MapPin, Phone } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Specialists', to: '/specialists' },
  { label: 'Booking', to: '/booking' },
  { label: 'Login', to: '/login' },
  { label: 'Register', to: '/register' },
];

const popularServices = [
  'Dental Check-up & Cleaning',
  'Haircut & Styling',
  'Skin & Hair Clinic Consultation',
  'Small Business Consulting',
  'Computer & IT Training',
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(20,184,166,0.18),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(45,212,191,0.08),transparent_22%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-brand text-white">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <span className="text-base font-bold tracking-tight">BookEase</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Book appointments with trusted specialists in minutes. Simple, fast
              and reliable — anytime, anywhere.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-300">
              <Clock className="h-4 w-4 text-teal-brand" />
              Open Mon–Sat, 9 AM – 8 PM
            </p>
          </div>

          {/* Quick links */}
          <nav aria-label="Quick links">
            <h3 className="text-sm font-bold tracking-widest text-slate-200 uppercase">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-slate-300 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Popular services (UI only for now) */}
          <div>
            <h3 className="text-sm font-bold tracking-widest text-slate-200 uppercase">
              Popular Services
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {popularServices.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold tracking-widest text-slate-200 uppercase">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-brand" />
                Kathmandu, Nepal
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-teal-brand" />
                +977-1-4000000
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-teal-brand" />
                hello@bookease.com.np
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-slate-400">
          © {CURRENT_YEAR} BookEase — Appointment &amp; Service Booking
          System. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
