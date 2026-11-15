// NotFound — friendly 404 page used for unknown routes.

import { Compass, Home, LifeBuoy } from 'lucide-react';
import Button from '../components/Button';

export default function NotFound() {
  return (
    <section className="hero-surface">
      <div className="container-page flex min-h-[62vh] flex-col items-center justify-center py-16 text-center">
        <span className="icon-tile-brand h-14 w-14 rounded-2xl">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-[11px] font-bold tracking-[0.18em] text-teal-deep uppercase">Error 404</p>
        <h1 className="mt-3 text-h1">This page could not be found</h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
          The link may be outdated, or the page may have moved. Let&apos;s get you back to
          booking.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/" size="lg">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Button>
          <Button to="/services" size="lg" variant="secondary">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Browse services
          </Button>
        </div>
      </div>
    </section>
  );
}
