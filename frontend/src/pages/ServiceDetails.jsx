// ServiceDetails — single service page at /services/:id
// Fetches full service details (including assigned specialists) from the API.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ServiceCard from '../components/ServiceCard';
import { useDemo } from '../store/DemoContext';

function DetailSkeleton() {
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="skeleton h-4 w-56" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <div className="skeleton aspect-[16/10] w-full rounded-3xl" />
          <div className="space-y-3">
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        </div>
        <div className="surface-card space-y-4 p-6">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-10 w-40" />
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ServiceDetails() {
  const { id } = useParams();
  const { services } = useDemo();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? '' : 'Service not found.');

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`/services/${encodeURIComponent(id)}`);
        if (alive) setService(data?.service || null);
      } catch (err) {
        if (alive) setError(err?.message || 'Failed to load service.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const relatedServices = useMemo(() => {
    if (!service) return [];
    const list = Array.isArray(services) ? services : [];
    return list
      .filter((item) => item.id !== service.id && item.category === service.category)
      .slice(0, 3);
  }, [services, service]);

  if (loading) return <DetailSkeleton />;

  if (error || !service) {
    return (
      <div className="container-page py-14">
        <EmptyState
          title={error ? 'Could not load service' : 'Service not found'}
          description={error || 'This service may have been removed. Browse all services instead.'}
          icon={Clock}
        >
          <Button to="/services" variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to services
          </Button>
        </EmptyState>
      </div>
    );
  }

  const specialists = Array.isArray(service.specialists) ? service.specialists : [];
  const benefits = Array.isArray(service.benefits) ? service.benefits.filter(Boolean) : [];
  const bookTo = `/booking?service=${encodeURIComponent(service.id)}`;

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-soft">
        <Link to="/" className="transition-colors hover:text-teal-deep">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link to="/services" className="transition-colors hover:text-teal-deep">
          Services
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="line-clamp-1 font-medium text-ink" aria-current="page">
          {service.name}
        </span>
      </nav>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-8">
          <div className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-card">
            <div className="relative aspect-[16/10] w-full bg-slate-100">
              {service.image ? (
                <img
                  src={service.image}
                  alt={service.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 text-ink-soft">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-9 w-9 text-teal-brand/70" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium">No image uploaded</p>
                  </div>
                </div>
              )}
              {service.categoryName ? (
                <span className="absolute top-4 left-4">
                  <Badge className="border border-white/60 bg-white/95 shadow-sm backdrop-blur">
                    {service.categoryName}
                  </Badge>
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {Number(service.rating) > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-100">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {service.rating} rating
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-deep ring-1 ring-teal-100/70">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {service.duration ? `${service.duration} minutes` : 'Flexible duration'}
              </span>
            </div>

            <h1 className="mt-4 text-h1">{service.name}</h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              {service.description || 'Full details for this service are available on request.'}
            </p>

            {service.providerName ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line/80 bg-white p-3.5 shadow-soft">
                {service.providerLogo ? (
                  <img
                    src={service.providerLogo}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-xl border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                    <Store className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">
                    Provided by
                  </p>
                  <Link
                    to={`/providers/${service.provider?.id || service.providerSlug}`}
                    className="truncate text-sm font-bold text-ink transition hover:text-teal-deep"
                  >
                    {service.providerName}
                  </Link>
                </div>
                {service.provider?.type ? (
                  <Badge variant="muted">
                    {service.provider.type === 'ORGANIZATION' ? 'Organization' : 'Individual'}
                  </Badge>
                ) : null}
                <Link
                  to={`/providers/${service.provider?.id || service.providerSlug}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-teal-deep hover:underline"
                >
                  View profile
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>

          {benefits.length ? (
            <section className="surface-card p-6 sm:p-7">
              <div className="flex items-center gap-2.5">
                <span className="icon-tile">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-h3">What&apos;s included</h2>
                  <p className="text-xs text-ink-soft">Everything covered in this appointment.</p>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-3 rounded-xl border border-line/80 bg-surface/60 px-4 py-3 text-sm leading-relaxed text-ink"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="surface-card p-6 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3">Specialists for this service</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Choose any of these professionals when you book.
                </p>
              </div>
              <Badge variant="muted">
                {specialists.length} available
              </Badge>
            </div>

            {specialists.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-ink-soft">
                No specialist is assigned to this service yet. You can still start a booking and pick
                from the available team.
              </p>
            ) : (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {specialists.map((specialist) => (
                  <li
                    key={specialist.id}
                    className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white p-3.5 transition duration-200 hover:border-teal-100 hover:shadow-soft"
                  >
                    {specialist.image ? (
                      <img
                        src={specialist.image}
                        alt={specialist.name}
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-line"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{specialist.name}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {specialist.title || specialist.specialty || 'Specialist'}
                        {Number(specialist.experience) > 0
                          ? ` · ${specialist.experience} yrs`
                          : ''}
                      </p>
                    </div>
                    <Link
                      to={`/specialists/${specialist.id}`}
                      className="shrink-0 rounded-lg p-2 text-ink-soft transition hover:bg-surface hover:text-teal-deep"
                      aria-label={`View ${specialist.name}'s profile`}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-24">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-line/80 bg-gradient-to-br from-teal-50/80 via-white to-white p-6">
              <p className="text-[11px] font-bold tracking-[0.16em] text-ink-soft uppercase">
                Starting from
              </p>
              <div className="mt-1 flex items-end gap-3">
                <p className="font-display text-4xl font-extrabold tracking-tight text-teal-deep">
                  {service.price || '—'}
                </p>
                <span className="pb-1 text-xs text-ink-soft">per appointment</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Final price confirmed at the studio.</p>
            </div>

            <div className="space-y-4 p-6">
              <dl className="space-y-3 text-sm">
                {service.providerName ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-soft">Provider</dt>
                    <dd className="min-w-0 truncate text-right font-semibold text-ink">
                      <Link
                        to={`/providers/${service.provider?.id || service.providerSlug}`}
                        className="transition hover:text-teal-deep hover:underline"
                      >
                        {service.providerName}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                <div className={`flex items-center justify-between gap-3 ${service.providerName ? 'border-t border-line/80 pt-3' : ''}`}>
                  <dt className="text-ink-soft">Duration</dt>
                  <dd className="font-semibold text-ink">
                    {service.duration ? `${service.duration} minutes` : 'Flexible'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line/80 pt-3">
                  <dt className="text-ink-soft">Category</dt>
                  <dd className="font-semibold text-ink">{service.categoryName || 'General'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line/80 pt-3">
                  <dt className="text-ink-soft">Specialists</dt>
                  <dd className="font-semibold text-ink">{specialists.length || 'Any'}</dd>
                </div>
              </dl>

              <Button to={bookTo} size="lg" fullWidth>
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book this service
              </Button>
              <Button to="/services" variant="secondary" size="lg" fullWidth>
                Browse all services
              </Button>

              <ul className="space-y-2 pt-1 text-xs text-ink-soft">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  No payment required to reserve.
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  Free cancellation up to 24 hours before.
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  Instant confirmation request.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-line/80 bg-white/70 p-4 text-xs leading-relaxed text-ink-soft shadow-soft">
            <p className="font-semibold text-ink">Not sure this is right?</p>
            <p className="mt-1">
              Browse the full catalog or view specialist profiles to compare before booking.
            </p>
          </div>
        </aside>
      </div>

      {relatedServices.length ? (
        <section className="mt-14 border-t border-line pt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-h2">More in {service.categoryName || 'this category'}</h2>
              <p className="mt-1 text-sm text-ink-soft">Other services you might want to compare.</p>
            </div>
            <Link
              to={`/services?category=${encodeURIComponent(service.category || 'all')}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedServices.map((item) => (
              <ServiceCard key={item.id} service={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
