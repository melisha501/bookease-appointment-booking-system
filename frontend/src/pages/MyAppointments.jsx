// My Appointments — the signed-in customer's full booking list with search,
// status filters, responsive table/cards and a confirmation before cancelling.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Search,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { appointmentDateTime, canCancelAppointment } from '../store/DemoContext';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dateParts(value) {
  if (!value) return { weekday: '—', day: '—', month: '—' };
  const date = new Date(`${value}T00:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: date.toLocaleDateString(undefined, { day: 'numeric' }),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function isUpcoming(item) {
  if (item.status !== 'pending' && item.status !== 'confirmed') return false;
  return appointmentDateTime(item).getTime() >= Date.now();
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/appointments/mine');
      if (mountedRef.current) {
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err?.message || 'Failed to load appointments.');
        setAppointments([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts = { all: appointments.length };
    appointments.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((item) => {
      const matchesSearch =
        !term ||
        [item.service, item.specialist, item.reference || item.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      const matchesStatus = activeStatus === 'all' || item.status === activeStatus;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, activeStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aUpcoming = isUpcoming(a);
      const bUpcoming = isUpcoming(b);
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      const aTime = appointmentDateTime(a).getTime() || 0;
      const bTime = appointmentDateTime(b).getTime() || 0;
      return aUpcoming ? aTime - bTime : bTime - aTime;
    });
  }, [filtered]);

  const handleCancel = async () => {
    if (!pendingCancel) return;
    const ref = pendingCancel.reference || pendingCancel.id;
    setMessage('');
    setError('');
    setCancelling(true);
    try {
      await api.patch(`/appointments/${encodeURIComponent(ref)}/cancel`, {});
      setMessage(`Appointment ${ref} was cancelled.`);
      setPendingCancel(null);
      await load();
    } catch (err) {
      setPendingCancel(null);
      setError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setActiveStatus('all');
  };

  const cancelRule = pendingCancel ? canCancelAppointment(pendingCancel) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft" aria-live="polite">
          Showing <span className="font-bold text-ink">{sorted.length}</span> of{' '}
          {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
        </p>
        <Button to="/booking" size="sm">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          New appointment
        </Button>
      </div>

      {message ? (
        <p
          role="status"
          className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
      {loadError && appointments.length > 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {loadError}{' '}
          <button type="button" onClick={load} className="font-semibold underline">
            Retry
          </button>
        </p>
      ) : null}

      <div className="surface-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search service, provider or reference…"
              aria-label="Search appointments"
              className="field rounded-full py-2.5 pr-10 pl-10 text-[13px]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:justify-end lg:px-0 lg:pb-0">
            {STATUS_FILTERS.map((filter) => {
              const count = statusCounts[filter.id] || 0;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveStatus(filter.id)}
                  aria-pressed={activeStatus === filter.id}
                  className={`chip shrink-0 px-3 py-1.5 text-xs ${
                    activeStatus === filter.id ? 'chip-active' : ''
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      activeStatus === filter.id
                        ? 'bg-white/20 text-white'
                        : 'bg-surface text-ink-soft'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="surface-card overflow-hidden p-5">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="skeleton h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError && appointments.length === 0 ? (
        <EmptyState title="Could not load appointments" description={loadError} icon={CalendarDays}>
          <Button onClick={load} variant="secondary">
            Try again
          </Button>
        </EmptyState>
      ) : sorted.length === 0 ? (
        appointments.length === 0 ? (
          <EmptyState
            title="No appointments yet"
            description="Book a service to see your appointments here."
            icon={CalendarDays}
          >
            <Button to="/booking">Book appointment</Button>
          </EmptyState>
        ) : (
          <EmptyState
            title="No appointments match your filters"
            description="Try a different search word or choose another status."
            icon={Search}
          >
            <Button onClick={clearFilters} variant="secondary">
              Clear filters
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          {/* Desktop table */}
          <div className="surface-card hidden overflow-hidden md:block">
            <div className="table-shell">
              <table className="table-base min-w-[860px]">
                <thead>
                  <tr className="table-head">
                    <th className="px-5 py-3.5">Reference</th>
                    <th className="px-5 py-3.5">Service</th>
                    <th className="px-5 py-3.5">Provider</th>
                    <th className="px-5 py-3.5">Schedule</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const ref = item.reference || item.id;
                    const rule = canCancelAppointment(item);
                    return (
                      <tr
                        key={ref}
                        className="border-b border-line/80 transition-colors last:border-0 hover:bg-surface/70"
                      >
                        <td className="px-5 py-4 font-semibold whitespace-nowrap text-ink">{ref}</td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-ink">{item.service}</span>
                          {isUpcoming(item) ? (
                            <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-deep">
                              Upcoming
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-ink-soft">{item.specialist}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="block text-ink">{formatDate(item.date)}</span>
                          <span className="text-xs text-ink-soft">{item.time}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={`/customer/appointments/details?ref=${ref}`}
                              className="font-semibold whitespace-nowrap text-teal-deep hover:underline"
                            >
                              View
                            </Link>
                            {rule.allowed ? (
                              <button
                                type="button"
                                onClick={() => setPendingCancel(item)}
                                className="inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap text-red-600 transition hover:text-red-700 hover:underline"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Cancel
                              </button>
                            ) : (
                              <span
                                className="cursor-help text-xs whitespace-nowrap text-slate-400"
                                title={rule.reason}
                              >
                                Not cancellable
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {sorted.map((item) => {
              const ref = item.reference || item.id;
              const rule = canCancelAppointment(item);
              const parts = dateParts(item.date);
              return (
                <article key={ref} className="surface-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-deep text-white">
                      <span className="text-[10px] font-bold tracking-wide uppercase">
                        {parts.weekday}
                      </span>
                      <span className="text-lg leading-none font-bold">{parts.day}</span>
                      <span className="text-[10px] font-medium">{parts.month}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-bold text-ink">{item.service}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">with {item.specialist}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {item.time} · {ref}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/80 pt-3">
                    <Link
                      to={`/customer/appointments/details?ref=${ref}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
                    >
                      View details
                    </Link>
                    {rule.allowed ? (
                      <button
                        type="button"
                        onClick={() => setPendingCancel(item)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Cancel
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400" title={rule.reason}>
                        Not cancellable
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel this appointment?"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep appointment"
      >
        {pendingCancel ? (
          <div className="space-y-2">
            <p>
              You are about to cancel{' '}
              <strong className="text-ink">{pendingCancel.service}</strong> with{' '}
              <strong className="text-ink">{pendingCancel.specialist}</strong> on{' '}
              <strong className="text-ink">{formatDate(pendingCancel.date)}</strong> at{' '}
              <strong className="text-ink">{pendingCancel.time}</strong>.
            </p>
            {cancelRule && !cancelRule.allowed ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {cancelRule.reason}
              </p>
            ) : (
              <p className="text-xs">This cannot be undone. You can always book a new time.</p>
            )}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
