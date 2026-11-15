// SpecialistDetails — single specialist page at /specialists/:id
// Fetches the profile and the services they provide from the API.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Briefcase,
  CalendarCheck,
  ChevronRight,
  Clock,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import SpecialistCard from '../components/SpecialistCard';
import { useDemo } from '../store/DemoContext';

function ProfileSkeleton() {
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="skeleton h-4 w-56" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="skeleton aspect-[4/5] rounded-3xl" />
        <div className="space-y-4">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-9 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-32 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export default function SpecialistDetails() {
  const { id } = useParams();
  const { services: allServices, specialists: allSpecialists } = useDemo();
  const [specialist, setSpecialist] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? '' : 'Specialist not found.');

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`/specialists/${encodeURIComponent(id)}`);
        if (alive) setSpecialist(data?.specialist || null);
      } catch (err) {
        if (alive) setError(err?.message || 'Failed to load specialist details.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const availableServices = useMemo(() => {
    if (Array.isArray(specialist?.services) && specialist.services.length) {
      return specialist.services;
    }
    const ids = Array.isArray(specialist?.serviceIds) ? specialist.serviceIds : [];
    const map = new Map((Array.isArray(allServices) ? allServices : []).map((s) => [s.id, s]));
    return ids.map((serviceId) => map.get(serviceId)).filter(Boolean);
  }, [specialist, allServices]);

  const relatedSpecialists = useMemo(() => {
    if (!specialist) return [];
    const list = Array.isArray(allSpecialists) ? allSpecialists : [];
    return list
      .filter(
        (item) =>
          item.id !== specialist.id &&
          specialist.specialty &&
          item.specialty === specialist.specialty
      )
      .slice(0, 3);
  }, [allSpecialists, specialist]);

  if (loading) return <ProfileSkeleton />;

  if (error || !specialist) {
    return (
      <div className="container-page py-14">
        <EmptyState
          title={error ? 'Could not load specialist' : 'Specialist not found'}
          description={
            error || 'This specialist profile may be unavailable. Browse all specialists instead.'
          }
          icon={UserRound}
        >
          <Button to="/specialists" variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to specialists
          </Button>
        </EmptyState>
      </div>
    );
  }

  const schedule = specialist.schedule;
  const scheduleDays = Array.isArray(schedule?.days)
    ? DAY_ORDER.filter((day) => schedule.days.includes(day))
    : [];
  const bookTo = `/booking?specialist=${encodeURIComponent(specialist.id)}`;
  const firstName = specialist.name?.split(' ')[0] || 'this specialist';

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-soft">
        <Link to="/" className="transition-colors hover:text-teal-deep">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link to="/specialists" className="transition-colors hover:text-teal-deep">
          Specialists
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="line-clamp-1 font-medium text-ink" aria-current="page">
          {specialist.name}
        </span>
      </nav>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Profile card */}
        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-card">
            <div className="relative aspect-[4/5] w-full bg-slate-100">
              {specialist.image ? (
                <img
                  src={specialist.image}
                  alt={specialist.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100">
                  <div className="text-center text-ink-soft">
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line">
                      <UserRound className="h-9 w-9 text-teal-brand/80" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-medium">No profile photo</p>
                  </div>
                </div>
              )}
              {Number(specialist.rating) > 0 ? (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm backdrop-blur">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {specialist.rating}
                </span>
              ) : null}
            </div>

            <div className="p-6">
              <Badge>{specialist.specialty || 'Specialist'}</Badge>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">{specialist.name}</h1>
              <p className="mt-1 text-sm font-semibold text-teal-deep">
                {specialist.title || specialist.specialty || 'Professional'}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                    Experience
                  </dt>
                  <dd className="mt-0.5 text-sm font-bold text-ink">
                    {Number(specialist.experience) > 0 ? `${specialist.experience} yrs` : '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                    Services
                  </dt>
                  <dd className="mt-0.5 text-sm font-bold text-ink">{availableServices.length}</dd>
                </div>
              </dl>

              <Button to={bookTo} fullWidth className="mt-5">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Book with {firstName}
              </Button>
              <p className="mt-2 text-center text-[11px] text-ink-soft">
                Free cancellation up to 24 hours before.
              </p>
            </div>
          </div>
        </aside>

        {/* Details */}
        <div className="min-w-0 space-y-6">
          <section className="surface-card p-6 sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-h3">About {firstName}</h2>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              {specialist.bio?.trim()
                ? specialist.bio
                : `${specialist.name} is a trusted ${
                    specialist.specialty || 'specialist'
                  } providing professional care and a comfortable appointment experience. Contact the studio for more details about qualifications and consultation approach.`}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line/80 bg-surface/60 p-4">
                <Award className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                  Role
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {specialist.title || 'Specialist'}
                </p>
              </div>
              <div className="rounded-xl border border-line/80 bg-surface/60 p-4">
                <Briefcase className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                  Experience
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {Number(specialist.experience) > 0
                    ? `${specialist.experience} years`
                    : 'Available on request'}
                </p>
              </div>
              <div className="rounded-xl border border-line/80 bg-surface/60 p-4">
                <Clock className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                  Hours
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {schedule?.start ? `${schedule.start} – ${schedule.end}` : 'See booking'}
                </p>
              </div>
            </div>

            {scheduleDays.length ? (
              <div className="mt-5 rounded-xl border border-line/80 bg-white p-4">
                <p className="text-xs font-bold tracking-[0.12em] text-ink-soft uppercase">
                  Working days
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAY_ORDER.map((day) => {
                    const active = scheduleDays.includes(day);
                    return (
                      <span
                        key={day}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          active
                            ? 'bg-teal-50 text-teal-deep ring-1 ring-teal-100'
                            : 'bg-surface text-slate-400'
                        }`}
                        title={DAY_LABELS[day]}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
                {schedule?.breakStart && schedule?.breakEnd ? (
                  <p className="mt-3 text-xs text-ink-soft">
                    Break: {schedule.breakStart} – {schedule.breakEnd}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="surface-card p-6 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3">Services by {firstName}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Book any of these treatments directly.
                </p>
              </div>
              <Badge variant="muted">
                {availableServices.length} service{availableServices.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {availableServices.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-ink-soft">
                No services are currently assigned to this specialist. Booking is still possible —
                choose a service first.
              </p>
            ) : (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {availableServices.map((service) => (
                  <li
                    key={service.id}
                    className="group flex h-full flex-col rounded-2xl border border-line/80 bg-white p-4 transition duration-200 hover:border-teal-100 hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-bold text-ink">{service.name}</p>
                        {service.categoryName ? (
                          <p className="mt-0.5 text-xs font-semibold text-teal-deep">
                            {service.categoryName}
                          </p>
                        ) : null}
                      </div>
                      {service.price ? (
                        <span className="shrink-0 text-sm font-bold text-ink">{service.price}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                      {service.description || 'Open the service page for full details.'}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {service.duration ? `${service.duration} min` : 'Flexible'}
                      </span>
                      <Link
                        to={`/services/${service.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-deep hover:underline"
                      >
                        Details
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/80 via-white to-white p-6 shadow-soft sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Ready to book with {firstName}?</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Pick a service and time that works for you — confirmation is instant.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-deep">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  No payment needed now
                </p>
              </div>
              <Button to={bookTo} className="shrink-0">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Book appointment
              </Button>
            </div>
          </section>
        </div>
      </div>

      {relatedSpecialists.length ? (
        <section className="mt-14 border-t border-line pt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-h2">More {specialist.specialty || ''} specialists</h2>
              <p className="mt-1 text-sm text-ink-soft">Compare experience and availability.</p>
            </div>
            <Link
              to="/specialists"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedSpecialists.map((item) => (
              <SpecialistCard key={item.id} specialist={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
