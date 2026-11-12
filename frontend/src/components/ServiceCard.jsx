// ServiceCard — consistent service tile used on Home, Services, and related views.
// Displays key info and provides View Details + Book actions.

import { ArrowRight, CalendarCheck, Clock, Image as ImageIcon, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from './Badge';
import Card from './Card';

export default function ServiceCard({ service, showActions = true, compact = false }) {
  const categoryName =
    typeof service?.categoryName === 'string' ? service.categoryName : service?.category;
  const imageUrl = typeof service?.image === 'string' ? service.image.trim() : '';
  const detailsTo = `/services/${service?.id || ''}`;
  const bookTo = `/booking?service=${encodeURIComponent(service?.id || '')}`;

  return (
    <Card padding="p-0" className="group flex h-full flex-col overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.28)]">
      <Link to={detailsTo} className="block focus:outline-none" aria-label={`View details for ${service?.name || 'service'}`}>
        <div className={`relative overflow-hidden bg-slate-100 ${compact ? 'h-40' : 'h-48'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={service?.name || 'Service'}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 text-ink-soft" aria-label="No image uploaded">
              <div className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-line">
                  <ImageIcon className="h-5 w-5 text-teal-brand/80" />
                </span>
                <p className="mt-2 text-xs font-medium">No image</p>
              </div>
            </div>
          )}
          {categoryName ? (
            <div className="absolute left-3 top-3">
              <Badge className="bg-white/90 shadow-sm backdrop-blur">{categoryName}</Badge>
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-[3rem] text-base font-bold tracking-tight text-ink sm:text-[1.05rem]">
            <Link to={detailsTo} className="transition-colors hover:text-teal-deep">
              {service?.name}
            </Link>
          </h3>
          {Number(service?.rating) > 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {service.rating}
            </span>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-ink-soft">
          {service?.description || 'Service details are available on the details page.'}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface/60 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-soft">Starting from</p>
            <p className="truncate text-base font-bold text-teal-deep">{service?.price}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-soft">
            <Clock className="h-4 w-4 text-teal-deep/80" />
            {service?.duration} mins
          </span>
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
