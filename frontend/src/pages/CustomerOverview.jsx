// Customer Overview — shows the logged-in customer's real appointments from the backend.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Clock, Plus, X } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useDemo } from '../store/DemoContext';

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CustomerOverview() {
  const { user } = useDemo();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const displayName = user?.name || 'Customer';

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
      .filter((i) => i.status === 'confirmed' || i.status === 'pending')
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return {
      total: list.length,
      upcoming: upcomingList.length,
      completed: list.filter((i) => i.status === 'completed').length,
      cancelled: list.filter((i) => i.status === 'cancelled').length,
      rejected: list.filter((i) => i.status === 'rejected').length,
      nextAppointment: upcomingList[0] || null,
      recent: [...list].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4),
    };
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-teal-deep px-6 py-8 text-white sm:px-8">
        <p className="text-sm text-teal-100">Good day,</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {displayName}</h2>
        <p className="mt-2 max-w-lg text-sm text-teal-100 sm:text-base">
          {upcoming > 0 ? `You have ${upcoming} upcoming appointment${upcoming === 1 ? '' : 's'}. Manage them below.` : 'No upcoming appointments. Book your next session today.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/booking" variant="light">
            <Plus className="h-4 w-4" /> Book Appointment
          </Button>
          <Button to="/customer/appointments" variant="onDark">
            View My Appointments
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Appointments" value={loading ? '—' : total} subtitle="All bookings" icon={CalendarDays} />
        <StatCard title="Upcoming" value={loading ? '—' : upcoming} subtitle="Confirmed & pending" icon={Clock} />
        <StatCard title="Completed" value={loading ? '—' : completed} subtitle="Finished visits" icon={Check} />
        <StatCard title="Cancelled" value={loading ? '—' : cancelled} subtitle="Cancelled bookings" icon={X} />
        <StatCard title="Rejected" value={loading ? '—' : rejected} subtitle="Declined requests" icon={X} />
      </div>

      <div>
        <h3 className="mb-3 text-base font-bold text-ink">Next Appointment</h3>
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : nextAppointment ? (
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-ink">{nextAppointment.service}</p>
                  <StatusBadge status={nextAppointment.status} />
                </div>
                <p className="text-sm text-ink-soft">with {nextAppointment.specialist}</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(nextAppointment.date)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{nextAppointment.time}</span>
                </p>
                <p className="text-xs text-ink-soft">Reference: {nextAppointment.reference || nextAppointment.id}</p>
              </div>
              <div className="flex gap-2">
                <Button to={`/customer/appointments/details?ref=${nextAppointment.reference || nextAppointment.id}`}>View Details</Button>
                <Button to="/booking" variant="secondary">Book New</Button>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState title="No upcoming appointments" description="When you book a service, your next appointment will show up here." icon={CalendarDays}>
            <Button to="/booking">Book Appointment</Button>
          </EmptyState>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Recent Appointment History</h3>
          <Link to="/customer/appointments" className="flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Card padding="p-0" className="overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No history yet" description="Your appointments will appear here after booking." icon={CalendarDays} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((item) => {
                const ref = item.reference || item.id;
                return (
                  <li key={ref}>
                    <Link to={`/customer/appointments/details?ref=${ref}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep"><CalendarDays className="h-5 w-5" /></span>
                        <span>
                          <span className="block text-sm font-bold text-ink">{item.service}</span>
                          <span className="block text-xs text-ink-soft">{item.specialist} · {ref}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pl-13 sm:pl-0">
                        <span className="text-sm text-ink-soft">{formatDate(item.date)} · {item.time}</span>
                        <StatusBadge status={item.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
