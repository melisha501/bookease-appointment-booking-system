// AdminOverview — live dashboard statistics from the backend (admin only).
//
// The page loads GET /api/dashboard/stats, which aggregates real PostgreSQL
// records. It refreshes on demand, every 30 seconds, and when the tab becomes
// visible/focused again so counts stay in sync with appointments, customers,
// services, and providers.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock,
  Layers,
  RefreshCw,
  Scissors,
  UserCheck,
  Users,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

const POLL_INTERVAL_MS = 30_000;

const EMPTY_STATS = {
  totalCustomers: 0,
  totalProviders: 0,
  totalServices: 0,
  totalAppointments: 0,
  pendingAppointments: 0,
  confirmedAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
  rejectedAppointments: 0,
};

const STATUS_STYLES = {
  pending: {
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    border: 'border-amber-200',
  },
  confirmed: {
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  completed: {
    dot: 'bg-teal-brand',
    bar: 'bg-teal-brand',
    border: 'border-teal-200',
  },
  cancelled: {
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
    border: 'border-slate-200',
  },
  rejected: {
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    border: 'border-rose-200',
  },
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

function EmptyBlock({ icon: Icon, title, description }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-10 text-center">
      {Icon && <Icon className="mx-auto h-8 w-8 text-teal-deep/70" />}
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p>
    </div>
  );
}

function StatusTile({ item }) {
  const style = statusStyle(item.status);
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${style.border}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-soft">{item.label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{item.count}</p>
      <p className="text-xs text-ink-soft">{item.percentage}% of appointments</p>
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
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    </div>
  );
}

export default function AdminOverview() {
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadInitialStats() {
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
        if (mountedRef.current) setLoading(false);
      }
    }

    loadInitialStats();
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-teal-deep px-6 py-6 text-white sm:px-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Overview</h2>
          <p className="mt-1 text-sm text-teal-100">Live statistics from your PostgreSQL database.</p>
          <p className="mt-2 text-xs text-teal-200">
            {lastUpdated
              ? `Updated ${formatUpdated(lastUpdated)} · refreshes automatically every 30 seconds`
              : 'Connecting to the database…'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => load()}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading || refreshing}>
            Retry
          </Button>
        </div>
      )}

      {loading && !data ? <DashboardSkeleton /> : null}

      {data ? (
        <>
          <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Customers"
              value={stats.totalCustomers}
              subtitle="Registered customer accounts"
              icon={Users}
            />
            <StatCard
              title="Total Providers"
              value={stats.totalProviders}
              subtitle="Service specialists"
              icon={UserCheck}
            />
            <StatCard
              title="Total Services"
              value={stats.totalServices}
              subtitle="Services in the catalog"
              icon={Scissors}
            />
            <StatCard
              title="Total Appointments"
              value={stats.totalAppointments}
              subtitle="All bookings on record"
              icon={CalendarDays}
              trend={`${activeAppointments} pending or confirmed`}
            />
          </section>

          <section aria-label="Appointment status counts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statusBreakdown.map((item) => (
              <StatusTile key={item.status} item={item} />
            ))}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <BarChart3 className="h-5 w-5 text-teal-deep" /> Appointment Statuses
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
                  <Activity className="h-5 w-5 text-teal-deep" /> Booking Activity
                </h3>
                <span className="text-xs font-semibold text-ink-soft">Last 7 days</span>
              </div>
              <BookingActivityChart days={bookingActivity} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-ink">Recent Appointments</h3>
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
                />
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs font-bold tracking-wider text-ink-soft uppercase">
                        <th className="pb-3 pr-4">Service / Reference</th>
                        <th className="pb-3 pr-4">Customer</th>
                        <th className="pb-3 pr-4">Provider</th>
                        <th className="pb-3 pr-4">Date &amp; Time</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAppointments.map((appointment) => {
                        const reference = appointment.reference || appointment.id;
                        return (
                          <tr
                            key={reference}
                            className="border-b border-line last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-bold text-ink">{appointment.service || '—'}</p>
                              <p className="text-xs text-ink-soft">{reference}</p>
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

            <Card>
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <Layers className="h-5 w-5 text-teal-deep" /> Quick Manage
              </h3>
              <div className="mt-4 flex flex-col gap-2">
                <Button to="/admin/appointments" variant="secondary">
                  <CalendarDays className="h-4 w-4" /> Manage Appointments
                </Button>
                <Button to="/admin/services" variant="secondary">
                  <Scissors className="h-4 w-4" /> Manage Services
                </Button>
                <Button to="/admin/providers" variant="secondary">
                  <UserCheck className="h-4 w-4" /> Manage Providers
                </Button>
                <Button to="/admin/customers" variant="secondary">
                  <Users className="h-4 w-4" /> View Customers
                </Button>
                <Button to="/admin/working-hours" variant="secondary">
                  <Clock className="h-4 w-4" /> Provider Schedules
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-lg font-bold text-amber-700">{stats.pendingAppointments}</p>
                  <p className="text-[11px] font-semibold text-amber-700/80 uppercase">Pending</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-lg font-bold text-emerald-700">{stats.confirmedAppointments}</p>
                  <p className="text-[11px] font-semibold text-emerald-700/80 uppercase">Confirmed</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                Working days, opening hours, breaks, and unavailable dates are saved to the database and used by booking availability.
              </p>
            </Card>
          </div>
        </>
      ) : null}

      {!loading && !data && !error ? (
        <EmptyBlock
          icon={BarChart3}
          title="Dashboard data is unavailable"
          description="No statistics were returned. Try refreshing the page."
        />
      ) : null}
    </div>
  );
}
