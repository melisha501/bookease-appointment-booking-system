// AuthShell — split-screen shell shared by Login and Register.
// The brand panel collapses to a compact header on small screens so the form
// always stays above the fold.

import { Check, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

export default function AuthShell({ eyebrow, title, description, points = [], children }) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(680px 320px at 10% 0%, rgba(20,184,166,0.12), transparent 62%), radial-gradient(620px 300px at 96% 6%, rgba(15,118,110,0.09), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="container-page relative py-8 sm:py-10 lg:py-14">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-line/80 bg-white shadow-pop lg:grid lg:grid-cols-[1.02fr_1fr]">
          {/* Brand panel */}
          <aside className="gradient-brand relative overflow-hidden px-6 py-7 text-white sm:px-8 sm:py-9 lg:flex lg:flex-col lg:px-10 lg:py-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(420px 220px at 15% 0%, rgba(255,255,255,0.18), transparent 62%), radial-gradient(380px 220px at 100% 100%, rgba(255,255,255,0.1), transparent 60%)',
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full border border-white/10"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full border border-white/10"
              aria-hidden="true"
            />

            <div className="relative">
              <Logo variant="dark" subtitle="Appointment booking" />
            </div>

            <div className="relative mt-7 lg:mt-12">
              {eyebrow ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-glow" aria-hidden="true" />
                  {eyebrow}
                </span>
              ) : null}
              <h1 className="mt-4 max-w-md text-balance font-display text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl lg:text-[2rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">{description}</p>
              ) : null}
            </div>

            {points.length ? (
              <ul className="relative mt-7 hidden gap-3 sm:grid lg:mt-auto lg:pt-10">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-white/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="relative mt-6 hidden items-center gap-2 text-[11px] font-medium tracking-wide text-white/55 lg:flex">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Secure JWT authentication · Your data stays private
            </p>
          </aside>

          {/* Form panel */}
          <div className="p-6 sm:p-9 lg:p-11">{children}</div>
        </div>
      </div>
    </div>
  );
}
