// SpecialistCard — consistent specialist tile with View Details and booking actions.

import { ArrowRight, CalendarCheck, Star, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from './Badge';
import Card from './Card';

export default function SpecialistCard({ specialist, serviceNames = [], showActions = true, compact = false }) {
  const names = Array.isArray(serviceNames) ? serviceNames.filter(Boolean) : [];
  const imageUrl = typeof specialist?.image === 'string' ? specialist.image.trim() : '';
  const detailsTo = `/specialists/${specialist?.id || ''}`;
  const bookTo = `/booking?specialist=${encodeURIComponent(specialist?.id || '')}`;

  return (
    <Card padding="p-0" className="group flex h-full flex-col overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.28)]">
      <Link to={detailsTo} className="block focus:outline-none" aria-label={`View details for ${specialist?.name || 'specialist'}`}>
        <div className={`relative overflow-hidden bg-slate-100 ${compact ? 'h-40' : 'h-48'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={specialist?.name || 'Specialist'}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 text-ink-soft" aria-label="No profile image">
              <div className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-line">
                  <User className="h-5 w-5 text-teal-brand/80" />
                </span>
                <p className="mt-2 text-xs font-medium">No photo</p>
              </div>
            </div>
          )}
          {specialist?.specialty ? (
            <div className="absolute left-3 top-3">
              <Badge className="bg-white/90 shadow-sm backdrop-blur">{specialist.specialty}</Badge>
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-bold tracking-tight text-ink sm:text-[1.05rem]">
              <Link to={detailsTo} className="transition-colors hover:text-teal-deep">
                {specialist?.name}
              </Link>
            </h3>
            <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-teal-deep">{specialist?.title}</p>
          </div>
          {Number(specialist?.rating) > 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {specialist.rating}
            </span>
          ) : null}
        </div>

        <div className="mt-3 min-h-[4.75rem] space-y-1.5 text-sm text-ink-soft">
          <p className="line-clamp-1">
            <span className="font-medium text-ink">Qualification:</span> {specialist?.title || '—'}
          </p>
          <p className="line-clamp-1">
            <span className="font-medium text-ink">Experience:</span>{' '}
            {Number(specialist?.experience) > 0 ? `${specialist.experience} years` : '—'}
          </p>
          <p className="line-clamp-1">
            <span className="font-medium text-ink">Services:</span> {names.length ? names.join(', ') : 'View details'}
          </p>
        </div>

        {showActions ? (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Link
              to={detailsTo}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              View Details
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={bookTo}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-teal-deep px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-12px_rgba(15,118,110,0.7)] transition-all hover:bg-teal-brand"
            >
              <CalendarCheck className="h-4 w-4" />
              Book
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
