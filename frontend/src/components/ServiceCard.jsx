// ServiceCard — consistent service tile used on Home, Services, and related views.
// Displays key info and provides View Details + Book actions.

import { ArrowRight, CalendarCheck, Clock, Image as ImageIcon, Star, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from './Badge';

export default function ServiceCard({ service, showActions = true }) {
  const categoryName =
    typeof service?.categoryName === 'string' ? service.categoryName : service?.category;
  const imageUrl = typeof service?.image === 'string' ? service.image.trim() : '';
  const detailsTo = `/services/${service?.id || ''}`;
  const bookTo = `/booking?service=${encodeURIComponent(service?.id || '')}`;
  const providerSlug = service?.provider?.id || service?.providerSlug || '';
  const providerName = service?.providerName || service?.provider?.name || '';

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-teal-100 hover:shadow-lift">
      <Link
        to={detailsTo}
        className="relative block aspect-[4/3] overflow-hidden bg-slate-100"
        aria-label={`View details for ${service?.name || 'service'}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={service?.name || 'Service'}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100">
            <div className="text-center text-ink-soft">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-line">
                <ImageIcon className="h-5 w-5 text-teal-brand/80" aria-hidden="true" />
              </span>
              <p className="mt-2 text-xs font-medium">No image</p>
            </div>
          </div>
        )}

        {categoryName ? (
          <span className="absolute top-3 left-3">
            <Badge className="border border-white/60 bg-white/90 shadow-sm backdrop-blur">
              {categoryName}
            </Badge>
          </span>
        ) : null}

        {Number(service?.rating) > 0 ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-xs font-bold text-amber-800 shadow-sm backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {service.rating}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-[1.05rem] leading-snug font-bold tracking-tight text-ink">
          <Link to={detailsTo} className="transition-colors hover:text-teal-deep">
            {service?.name}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {service?.description || 'Service details are available on the details page.'}
        </p>

        {providerName ? (
          <div className="mt-3 flex items-center gap-2">
            {service?.providerLogo || service?.provider?.logo ? (
              <img
                src={service.providerLogo || service.provider?.logo}
                alt=""
                loading="lazy"
                className="h-6 w-6 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-deep">
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 truncate text-xs text-ink-soft">
              by{' '}
              {providerSlug ? (
                <Link
                  to={`/providers/${providerSlug}`}
                  className="font-semibold text-teal-deep hover:underline"
                >
                  {providerName}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{providerName}</span>
              )}
            </span>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/80 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">From</p>
            <p className="truncate text-base font-bold text-teal-deep">{service?.price || '—'}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <Clock className="h-3.5 w-3.5 text-teal-deep/80" aria-hidden="true" />
            {service?.duration ? `${service.duration} min` : 'Flexible'}
          </span>
        </div>

        {showActions ? (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Link
              to={detailsTo}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] font-semibold text-ink transition duration-200 hover:border-slate-300 hover:bg-slate-50"
            >
              Details
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
