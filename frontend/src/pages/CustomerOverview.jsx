// Customer Overview — greeting, live stats, next appointment and recent history
// for the signed-in customer, all loaded from the backend.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Scissors,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { appointmentDateTime, useDemo } from '../store/DemoContext';

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function relativeLabel(appointment) {
  if (!appointment?.date) return '';
  const target = appointmentDateTime(appointment).getTime();
  if (!Number.isFinite(target)) return '';
  const diffDays = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Started';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 30) return `In ${diffDays} days`;
  return '';
}

function AppointmentSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-3 w-56" />
      <div className="skeleton h-3 w-32" />
    </div>
  );
}

export default function CustomerOverview() {
  const { user } = useDemo();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const displayName = user?.name || 'there';
  const firstName = displayName.split(' ')[0];

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get('/appointments/mine');
        if (alive) setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      } catch (err) {
        if (alive) setError(err?.message || 'Failed to load appointments.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const { total, upcoming, completed, cancelled, rejected, nextAppointment, recent } = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    const upcomingList = list
      .filter((item) => item.status === 'confirmed' || item.status === 'pending')
      .sort((a, b) => appointmentDateTime(a).getTime() - appointmentDateTime(b).getTime());
    return {
      total: list.length,
      upcoming: upcomingList.length,
      completed: list.filter((item) => item.status === 'completed').length,
      cancelled: list.filter((item) => item.status === 'cancelled').length,
      rejected: list.filter((item) => item.status === 'rejected').length,
      nextAppointment: upcomingList[0] || null,
      recent: [...list]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 4),
    };
  }, [appointments]);

  const nextLabel = nextAppointment ? relativeLabel(nextAppointment) : '';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-teal-deep px-6 py-7 text-white shadow-card sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(520px 240px at 92% 0%, rgba(45,212,191,0.22), transparent 62%), radial-gradient(420px 220px at 8% 100%, rgba(255,255,255,0.08), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-teal-100 uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {greeting()}
            </p>
            <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {firstName}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-teal-50/85">
              {upcoming > 0
                ? `You have ${upcoming} upcoming appointment${upcoming === 1 ? '' : 's'}. ${
                    nextLabel ? `Your next visit is ${nextLabel.toLowerCase()}.` : 'Manage them below.'
                  }`
                : 'No upcoming appointments. Book your next session whenever you are ready.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button to="/booking" variant="light" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Book appointment
              </Button>
              <Button to="/customer/appointments" variant="onDark" size="sm">
                My appointments
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.14em] text-teal-100 uppercase">Upcoming</p>
              <p className="mt-0.5 text-2xl font-bold">{loading ? '—' : upcoming}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.14em] text-teal-100 uppercase">Completed</p>
              <p className="mt-0.5 text-2xl font-bold">{loading ? '—' : completed}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total"
          value={loading ? '—' : total}
          subtitle="All bookings"
          icon={CalendarDays}
        />
        <StatCard
          title="Upcoming"
          value={loading ? '—' : upcoming}
          subtitle="Confirmed & pending"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          title="Completed"
          value={loading ? '—' : completed}
          subtitle="Finished visits"
          icon={Check}
          tone="emerald"
        />
        <StatCard
          title="Cancelled"
          value={loading ? '—' : cancelled}
          subtitle="Cancelled bookings"
          icon={X}
          tone="slate"
        />
        <StatCard
          title="Rejected"
          value={loading ? '—' : rejected}
          subtitle="Declined requests"
          icon={X}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Next appointment + history */}
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Next appointment</h3>
              {nextLabel ? (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-deep ring-1 ring-teal-100">
                  {nextLabel}
                </span>
              ) : null}
            </div>

            {loading ? (
              <AppointmentSkeleton />
            ) : nextAppointment ? (
              <div className="surface-card overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-deep text-white">
                      <span className="text-[10px] font-bold tracking-wide uppercase">
                        {new Date(`${nextAppointment.date}T00:00:00`).toLocaleDateString(undefined, {
                          month: 'short',
                        })}
                      </span>
                      <span className="text-xl leading-none font-bold">
                        {new Date(`${nextAppointment.date}T00:00:00`).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-bold text-ink">
                          {nextAppointment.service}
                        </p>
                        <StatusBadge status={nextAppointment.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink-soft">
                        with {nextAppointment.specialist}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatDate(nextAppointment.date)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {nextAppointment.time}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Ref {nextAppointment.reference || nextAppointment.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      to={`/customer/appointments/details?ref=${
                        nextAppointment.reference || nextAppointment.id
                      }`}
                      size="sm"
                    >
                      View details
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No upcoming appointments"
                description="When you book a service, your next appointment will show up here."
                icon={CalendarDays}
              >
                <Button to="/booking">Book appointment</Button>
              </EmptyState>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Recent history</h3>
              <Link
                to="/customer/appointments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="surface-card overflow-hidden">
              {loading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="skeleton h-12 w-full" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No history yet"
                    description="Your appointments will appear here after booking."
                    icon={CalendarDays}
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map((item) => {
                    const ref = item.reference || item.id;
                    return (
                      <li key={ref}>
                        <Link
                          to={`/customer/appointments/details?ref=${ref}`}
                          className="flex flex-col gap-2 px-5 py-4 transition hover:bg-surface/70 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
                              <CalendarDays className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-ink">
                                {item.service}
                              </span>
                              <span className="block truncate text-xs text-ink-soft">
                                {item.specialist} · {ref}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pl-13 sm:justify-end sm:pl-0">
                            <span className="text-xs text-ink-soft">
                              {formatDate(item.date)} · {item.time}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Quick actions */}
        <aside className="space-y-3">
          <h3 className="text-base font-bold text-ink">Quick actions</h3>
          {[
            {
              to: '/booking',
              icon: CalendarPlus,
              title: 'Book a new appointment',
              description: 'Choose a service, specialist and time.',
            },
            {
              to: '/services',
              icon: Scissors,
              title: 'Browse services',
              description: 'Compare treatments and prices.',
            },
            {
              to: '/customer/profile',
              icon: UserRound,
              title: 'Update your profile',
              description: 'Keep your contact details current.',
            },
          ].map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-3 rounded-2xl border border-line/90 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-teal-100 hover:shadow-soft"
            >
              <span className="icon-tile h-10 w-10">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                  {description}
                </span>
              </span>
              <ArrowRight
                className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-deep"
                aria-hidden="true"
              />
            </Link>
          ))}

          <div className="rounded-2xl border border-line/80 bg-white/70 p-4 shadow-soft">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <CheckCircle2 className="h-4 w-4 text-teal-deep" aria-hidden="true" />
              Need to cancel?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              Cancellations are free up to 24 hours before your appointment. Open a booking to
              cancel or check the cut-off.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
