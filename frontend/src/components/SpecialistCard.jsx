// SpecialistCard — consistent specialist tile with View Details and booking actions.

import { ArrowRight, CalendarCheck, Star, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from './Badge';

export default function SpecialistCard({ specialist, serviceNames = [], showActions = true }) {
  const names = Array.isArray(serviceNames) ? serviceNames.filter(Boolean) : [];
  const imageUrl = typeof specialist?.image === 'string' ? specialist.image.trim() : '';
  const detailsTo = `/specialists/${specialist?.id || ''}`;
  const bookTo = `/booking?specialist=${encodeURIComponent(specialist?.id || '')}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-teal-100 hover:shadow-lift">
      <div className="relative aspect-[5/4] overflow-hidden bg-slate-100">
        <Link
          to={detailsTo}
          className="block h-full w-full"
          aria-label={`View details for ${specialist?.name || 'specialist'}`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={specialist?.name || 'Specialist'}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100">
              <div className="text-center text-ink-soft">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line">
                  <User className="h-6 w-6 text-teal-brand/80" aria-hidden="true" />
                </span>
                <p className="mt-2 text-xs font-medium">No photo</p>
              </div>
            </div>
          )}
        </Link>

        {specialist?.specialty ? (
          <span className="pointer-events-none absolute top-3 left-3">
            <Badge className="border border-white/60 bg-white/90 shadow-sm backdrop-blur">
              {specialist.specialty}
            </Badge>
          </span>
        ) : null}

        {Number(specialist?.rating) > 0 ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-xs font-bold text-amber-800 shadow-sm backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {specialist.rating}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-[1.05rem] font-bold tracking-tight text-ink">
            <Link to={detailsTo} className="transition-colors hover:text-teal-deep">
              {specialist?.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-teal-deep">
            {specialist?.title || 'Specialist'}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-soft">
          <span>
            <span className="text-ink">Experience:</span>{' '}
            {Number(specialist?.experience) > 0 ? `${specialist.experience} yrs` : '—'}
          </span>
          <span className="line-clamp-1 min-w-0 max-w-full">
            <span className="text-ink">Services:</span>{' '}
            {names.length ? names.slice(0, 2).join(', ') : 'View profile'}
          </span>
        </div>

        {showActions ? (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <Link
              to={detailsTo}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] font-semibold text-ink transition duration-200 hover:border-slate-300 hover:bg-slate-50"
            >
              Profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to={bookTo}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-deep px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_22px_-16px_rgba(15,118,110,0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-teal-800"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Book
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
