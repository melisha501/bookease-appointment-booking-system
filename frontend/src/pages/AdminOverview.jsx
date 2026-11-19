// AdminOverview — live dashboard statistics from the backend (admin only).
//
// The page loads GET /api/dashboard/stats, which aggregates real PostgreSQL
// records. It refreshes on demand, every 30 seconds, and when the tab becomes
// visible/focused again so counts stay in sync with appointments, customers,
// services, and providers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useDemo } from '../store/DemoContext';

const POLL_INTERVAL_MS = 30_000;

const EMPTY_STATS = {
  totalCustomers: 0,
  totalProviders: 0,
  providerAccounts: 0,
  pendingProviderAccounts: 0,
  pendingServiceApprovals: 0,
  totalServices: 0,
  totalAppointments: 0,
  pendingAppointments: 0,
  confirmedAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
  rejectedAppointments: 0,
};

const STATUS_STYLES = {
  pending: { dot: 'bg-amber-500', bar: 'bg-amber-500', border: 'border-amber-200' },
  confirmed: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', border: 'border-emerald-200' },
  completed: { dot: 'bg-teal-brand', bar: 'bg-teal-brand', border: 'border-teal-200' },
  cancelled: { dot: 'bg-slate-400', bar: 'bg-slate-400', border: 'border-slate-200' },
  rejected: { dot: 'bg-rose-500', bar: 'bg-rose-500', border: 'border-rose-200' },
};

const FALLBACK_STATUS_STYLE = STATUS_STYLES.pending;

function statusStyle(status) {
  return STATUS_STYLES[status] || FALLBACK_STATUS_STYLE;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatUpdated(value) {
  if (!value) return '';
  return value.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function EmptyBlock({ icon: Icon, title, description, action }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-10 text-center">
      {Icon && <Icon className="mx-auto h-8 w-8 text-teal-deep/70" aria-hidden="true" />}
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function StatusTile({ item }) {
  const style = statusStyle(item.status);
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card ${style.border}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-soft">{item.label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
      </div>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{item.count}</p>
      <p className="text-[11px] text-ink-soft">{item.percentage}% of appointments</p>
    </div>
  );
}

function StatusBreakdownChart({ items, total }) {
  if (total === 0) {
    return (
      <EmptyBlock
        icon={BarChart3}
        title="No appointment data yet"
        description="The status distribution will appear as soon as the first appointment is created."
      />
    );
  }

  return (
    <ul className="mt-5 space-y-4">
      {items.map((item) => {
        const style = statusStyle(item.status);
        return (
          <li key={item.status}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
                {item.label}
              </span>
              <span className="text-ink-soft">
                <span className="font-bold text-ink">{item.count}</span> · {item.percentage}%
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                style={{ width: `${Math.max(0, Math.min(100, Number(item.percentage) || 0))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BookingActivityChart({ days }) {
  const total = days.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
  const max = Math.max(1, ...days.map((day) => Number(day.count) || 0));

  if (total === 0) {
    return (
      <EmptyBlock
        icon={Activity}
        title="No bookings in the last 7 days"
        description="New bookings will appear here as they are created, grouped by day."
      />
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: 168 }}>
        {days.map((day) => {
          const count = Number(day.count) || 0;
          const barHeight = count > 0 ? Math.max(6, Math.round((count / max) * 116)) : 4;
          return (
            <div
              key={day.date}
              className="flex h-full flex-1 flex-col items-center justify-end"
              title={`${count} booking${count === 1 ? '' : 's'} on ${day.date}`}
            >
              <span className="text-xs font-bold text-ink">{count}</span>
              <div
                className={`mt-1 w-full max-w-10 rounded-t-lg transition-all duration-500 ${
                  count > 0 ? 'bg-teal-brand' : 'bg-slate-200'
                }`}
                style={{ height: `${barHeight}px` }}
              />
              <span className="mt-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard statistics…</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-2xl border border-line bg-white p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { user } = useDemo();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const payload = await api.get('/dashboard/stats');
      if (!mountedRef.current) return;
      setData(payload);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to load dashboard statistics.');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const load = useCallback(
    ({ silent = false } = {}) => {
      if (inFlightRef.current) return;
      setError('');
      if (silent) setRefreshing(true);
      else setLoading(true);
      fetchStats();
    },
    [fetchStats]
  );

  // Initial load and teardown guard.
  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  // Keep statistics fresh while the dashboard is open.
  useEffect(() => {
    const interval = window.setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  const stats = data?.stats || EMPTY_STATS;
  const statusBreakdown = Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [];
  const bookingActivity = Array.isArray(data?.bookingActivity) ? data.bookingActivity : [];
  const recentAppointments = Array.isArray(data?.recentAppointments) ? data.recentAppointments : [];
  const activeAppointments = stats.pendingAppointments + stats.confirmedAppointments;
  const firstName = String(user?.name || 'Admin').split(' ')[0];

  const attention = useMemo(() => {
    const items = [];
    if (stats.pendingAppointments > 0) {
      items.push(
        `${stats.pendingAppointments} pending request${stats.pendingAppointments === 1 ? '' : 's'}`
      );
    }
    if (stats.pendingProviderAccounts > 0) {
      items.push(
        `${stats.pendingProviderAccounts} provider application${stats.pendingProviderAccounts === 1 ? '' : 's'} awaiting review`
      );
    }
    if (stats.pendingServiceApprovals > 0) {
      items.push(
        `${stats.pendingServiceApprovals} service${stats.pendingServiceApprovals === 1 ? '' : 's'} awaiting approval`
      );
    }
    if (stats.providerAccounts === 0) items.push('no provider accounts registered');
    if (stats.totalServices === 0) items.push('no services in the catalog');
    return items;
  }, [
    stats.pendingAppointments,
    stats.pendingProviderAccounts,
    stats.pendingServiceApprovals,
    stats.providerAccounts,
    stats.totalServices,
  ]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-teal-deep px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              'radial-gradient(520px 240px at 92% 0%, rgba(45,212,191,0.24), transparent 62%), radial-gradient(420px 220px at 8% 100%, rgba(255,255,255,0.08), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-teal-100 uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Business overview
            </p>
            <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {firstName}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-teal-50/85">
              {attention.length > 0
                ? `Needs attention: ${attention.join(' · ')}.`
                : 'Everything looks caught up. Your catalog and appointment queue are in good shape.'}
            </p>
            <p className="mt-3 text-xs text-teal-100/80">
              {lastUpdated
                ? `Updated ${formatUpdated(lastUpdated)} · refreshes automatically every 30 seconds`
                : 'Connecting to the database…'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button to="/admin/appointments" variant="light" size="sm">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Manage appointments
              </Button>
              <Button to="/admin/approvals" variant="onDark" size="sm">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Review approvals
              </Button>
              <Button to="/admin/services" variant="onDark" size="sm">
                <Scissors className="h-4 w-4" aria-hidden="true" />
                Manage services
              </Button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.14em] text-teal-100 uppercase">
                Pending
              </p>
              <p className="mt-0.5 text-2xl font-bold">{loading ? '—' : stats.pendingAppointments}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.14em] text-teal-100 uppercase">
                Confirmed
              </p>
              <p className="mt-0.5 text-2xl font-bold">{loading ? '—' : stats.confirmedAppointments}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.14em] text-teal-100 uppercase">
                Active bookings
              </p>
              <p className="mt-0.5 text-2xl font-bold">{loading ? '—' : activeAppointments}</p>
            </div>
            <Button
              variant="onDark"
              size="sm"
              onClick={() => load()}
              disabled={loading || refreshing}
              className="w-full"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading || refreshing}>
            Try again
          </Button>
        </div>
      )}

      {loading && !data ? <DashboardSkeleton /> : null}

      {data ? (
        <>
          <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total customers"
              value={stats.totalCustomers}
              subtitle="Registered customer accounts"
              icon={Users}
            />
            <StatCard
              title="Total specialists"
              value={stats.totalProviders}
              subtitle="Service specialists in the catalog"
              icon={UserCheck}
            />
            <StatCard
              title="Total services"
              value={stats.totalServices}
              subtitle="Services in the catalog"
              icon={Scissors}
            />
            <StatCard
              title="Total appointments"
              value={stats.totalAppointments}
              subtitle="All bookings on record"
              icon={CalendarDays}
              trend={`${activeAppointments} pending or confirmed`}
            />
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <ShieldCheck className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                  Provider accounts &amp; approvals
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Provider registrations are separate from catalog specialists. New accounts and
                  provider-created services stay hidden from customers until approved.
                </p>
              </div>
              <Link
                to="/admin/approvals"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
              >
                Open approval queue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Provider accounts',
                  value: stats.providerAccounts,
                  hint: 'Registered provider profiles',
                  icon: UserCheck,
                },
                {
                  label: 'Pending providers',
                  value: stats.pendingProviderAccounts,
                  hint: 'Applications awaiting review',
                  icon: Clock,
                },
                {
                  label: 'Pending services',
                  value: stats.pendingServiceApprovals,
                  hint: 'Services awaiting moderation',
                  icon: Scissors,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-line bg-surface/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
                      <Icon className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                      {item.label}
                    </div>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{item.value}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <section aria-label="Appointment status counts">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Appointment status</h3>
              <Link
                to="/admin/appointments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {statusBreakdown.map((item) => (
                <StatusTile key={item.status} item={item} />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <BarChart3 className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                  Status breakdown
                </h3>
                <span className="text-xs font-semibold text-ink-soft">
                  {stats.totalAppointments} total
                </span>
              </div>
              <StatusBreakdownChart items={statusBreakdown} total={stats.totalAppointments} />
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Activity className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                  Booking activity
                </h3>
                <span className="text-xs font-semibold text-ink-soft">Last 7 days</span>
              </div>
              <BookingActivityChart days={bookingActivity} />
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="min-w-0 xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-ink">Recent appointments</h3>
                <Link
                  to="/admin/appointments"
                  className="text-sm font-semibold whitespace-nowrap text-teal-deep hover:underline"
                >
                  View all
                </Link>
              </div>

              {recentAppointments.length === 0 ? (
                <EmptyBlock
                  icon={CalendarDays}
                  title="No appointments yet"
                  description="New bookings will appear here with the customer, service, provider, date, and status."
                  action={<Button to="/booking" size="sm">Open booking flow</Button>}
                />
              ) : (
                <div className="mt-4 overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                        <th className="pb-3 pr-4">Service / Reference</th>
                        <th className="pb-3 pr-4">Customer</th>
                        <th className="pb-3 pr-4">Provider</th>
                        <th className="pb-3 pr-4">Schedule</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAppointments.map((appointment) => {
                        const reference = appointment.reference || appointment.id;
                        return (
                          <tr
                            key={reference}
                            className="border-b border-line transition last:border-0 hover:bg-surface/60"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-bold text-ink">{appointment.service || '—'}</p>
                              <p className="font-mono text-[10px] text-ink-soft">{reference}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <p className="font-semibold text-ink">
                                {appointment.customerName || appointment.customer || '—'}
                              </p>
                              <p className="text-xs text-ink-soft">{appointment.customerEmail || ''}</p>
                            </td>
                            <td className="py-3 pr-4 text-ink-soft">{appointment.specialist || '—'}</td>
                            <td className="py-3 pr-4 whitespace-nowrap">
                              <p className="font-semibold text-ink">{formatDate(appointment.date)}</p>
                              <p className="text-xs text-ink-soft">{appointment.time || '—'}</p>
                            </td>
                            <td className="py-3 text-right">
                              <StatusBadge status={appointment.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Layers className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                  Quick manage
                </h3>
                <div className="mt-4 flex flex-col gap-2">
                  <Button to="/admin/appointments" variant="secondary" size="sm">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" /> Appointments
                  </Button>
                  <Button to="/admin/services" variant="secondary" size="sm">
                    <Scissors className="h-4 w-4" aria-hidden="true" /> Services
                  </Button>
                  <Button to="/admin/providers" variant="secondary" size="sm">
                    <UserCheck className="h-4 w-4" aria-hidden="true" /> Providers
                  </Button>
                  <Button to="/admin/customers" variant="secondary" size="sm">
                    <Users className="h-4 w-4" aria-hidden="true" /> Customers
                  </Button>
                  <Button to="/admin/working-hours" variant="secondary" size="sm">
                    <Clock className="h-4 w-4" aria-hidden="true" /> Working hours
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                    <p className="text-lg font-bold text-amber-700">{stats.pendingAppointments}</p>
                    <p className="text-[10px] font-bold tracking-wide text-amber-700/80 uppercase">
                      Pending
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                    <p className="text-lg font-bold text-emerald-700">
                      {stats.confirmedAppointments}
                    </p>
                    <p className="text-[10px] font-bold tracking-wide text-emerald-700/80 uppercase">
                      Confirmed
                    </p>
                  </div>
                </div>
              </Card>

              <div className="rounded-2xl border border-teal-100/80 bg-teal-50/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-teal-deep">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Availability is live
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  Working days, opening hours, breaks, and unavailable dates are stored in the
                  database and used by booking availability.
                </p>
                <Link
                  to="/admin/working-hours"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-deep hover:underline"
                >
                  Review schedules
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {!loading && !data && !error ? (
        <EmptyBlock
          icon={CalendarPlus}
          title="Dashboard data is unavailable"
          description="No statistics were returned. Try refreshing the page."
          action={
            <Button size="sm" onClick={() => load()}>
              Refresh
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
