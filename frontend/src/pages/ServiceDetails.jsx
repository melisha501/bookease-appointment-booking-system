// ServiceDetails — single service page at /services/:id
// Fetches service details (and assigned specialists) from the backend API.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Clock, Sparkles, Star, User } from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';

export default function ServiceDetails() {
  const { id } = useParams();
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

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="animate-pulse">
          <div className="h-6 w-48 rounded bg-slate-100" />
          <div className="mt-4 h-64 rounded-2xl bg-slate-100" />
        </Card>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <EmptyState
          title={error ? 'Could not load service' : 'Service not found'}
          description={error || 'This service may have been removed. Browse all services instead.'}
          icon={Clock}
        >
          <Button to="/services" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back to Services
          </Button>
        </EmptyState>
      </div>
    );
  }

  const relatedSpecialists = Array.isArray(service.specialists) ? service.specialists : [];
  const benefits = Array.isArray(service.benefits) ? service.benefits : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-slate-300 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Services
        </Link>
        <Button to={`/booking?service=${encodeURIComponent(service.id)}`} size="sm">
          <CalendarCheck className="h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="overflow-hidden rounded-[1.75rem] border border-line/80 bg-white shadow-sm">
            {service.image ? (
              <img
                src={service.image}
                alt={service.name}
                className="h-72 w-full object-cover sm:h-[420px]"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 text-sm font-medium text-ink-soft sm:h-[420px]">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-teal-brand/70" />
                  <p className="mt-2">No image uploaded</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Card className="h-full">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{service.categoryName}</Badge>
            {Number(service?.rating) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-800">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {service.rating} rating
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{service.name}</h1>
          <p className="mt-4 leading-relaxed text-ink-soft">{service.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Price</p>
              <p className="mt-1 text-2xl font-bold text-teal-deep">{service.price}</p>
              <p className="text-xs text-ink-soft">Starting price (NPR)</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Duration</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-ink">
                <Clock className="h-5 w-5 text-teal-deep" />
                {service.duration} mins
              </p>
              <p className="text-xs text-ink-soft">Estimated appointment time</p>
            </div>
          </div>

          <dl className="mt-6 space-y-3 rounded-2xl border border-line/80 bg-white p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">Category</dt>
              <dd className="font-semibold text-ink">{service.categoryName || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
              <dt className="text-ink-soft">Available specialists</dt>
              <dd className="font-semibold text-ink">{relatedSpecialists.length}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button to={`/booking?service=${encodeURIComponent(service.id)}`} size="lg" fullWidth>
              <CalendarCheck className="h-5 w-5" />
              Book Appointment
            </Button>
            <Button to="/services" variant="secondary" size="lg" fullWidth>
              Browse Services
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-soft">No payment needed now — pay at the studio.</p>
        </Card>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-teal-deep" />
            <h2 className="text-xl font-bold text-ink">What&apos;s Included</h2>
          </div>
          {benefits.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Details will be available soon.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-ink">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Available Specialists</h2>
              <p className="mt-1 text-sm text-ink-soft">Professionals who can provide this service.</p>
            </div>
            <Badge variant="muted">{relatedSpecialists.length}</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {relatedSpecialists.length === 0 ? (
              <p className="text-sm text-ink-soft">No specialist assigned to this service yet.</p>
            ) : (
              relatedSpecialists.map((specialist) => (
                <div
                  key={specialist.id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/40 p-4 transition-all hover:border-teal-100 hover:bg-white sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    {specialist.image ? (
                      <img
                        src={specialist.image}
                        alt={specialist.name}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-line"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-teal-deep ring-1 ring-line">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{specialist.name}</p>
                      <p className="truncate text-sm text-ink-soft">
                        {specialist.title}
                        {Number(specialist?.experience) > 0 ? ` · ${specialist.experience} yrs` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                    {Number(specialist?.rating) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {specialist.rating}
                      </span>
                    ) : null}
                    <Link
                      to={`/specialists/${specialist.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-slate-300"
                    >
                      View
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}