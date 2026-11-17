// ProviderAppointments — bookings for the signed-in provider's services.
// Status changes use the same transition rules as the admin portal and are
// enforced again on the backend.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import {
  allowedAdminTransitions,
  appointmentStatusLabel,
  normalizeAppointmentStatus,
} from '../utils/appointmentStatus';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
];

const ACTION_LABELS = {
  confirmed: 'Confirm',
  completed: 'Mark completed',
  cancelled: 'Cancel',
  rejected: 'Reject',
};

const ACTION_ICONS = {
  confirmed: Check,
  completed: CheckCheck,
  cancelled: X,
  rejected: X,
};

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

export default function ProviderAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [updatingRef, setUpdatingRef] = useState('');
  const [pendingChange, setPendingChange] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/providers/me/appointments');
      setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch (err) {
      setLoadError(err?.message || 'Could not load appointments.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts = { all: appointments.length };
    appointments.forEach((item) => {
      const key = normalizeAppointmentStatus(item.status) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((item) => {
      const matchesStatus = activeStatus === 'all' || normalizeAppointmentStatus(item.status) === activeStatus;
      const matchesSearch =
        !term ||
        [item.reference || item.id, item.customer, item.customerEmail, item.service, item.time]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [appointments, activeStatus, search]);

  const applyStatus = async (appointment, nextStatus) => {
    const ref = appointment.reference || appointment.id;
    setMessage('');
    setError('');
    setUpdatingRef(ref);
    try {
      const data = await api.patch(
        `/providers/me/appointments/${encodeURIComponent(ref)}/status`,
        { status: nextStatus }
      );
      const updated = data?.appointment;
      if (updated) {
        setAppointments((current) =>
          current.map((item) =>
            (item.reference || item.id) === (updated.reference || updated.id) ? updated : item
          )
        );
      } else {
        await load();
      }
      const who = appointment.customer || 'the customer';
      setMessage(
        data?.message ||
          `Appointment ${ref} marked ${appointmentStatusLabel(nextStatus).toLowerCase()} for ${who}.`
      );
    } catch (err) {
      setError(err?.message || 'Could not update the appointment status.');
    } finally {
      setUpdatingRef('');
      setPendingChange(null);
    }
  };

  const requestChange = (appointment, nextStatus) => {
    if (nextStatus === 'cancelled' || nextStatus === 'rejected') {
      setPendingChange({ appointment, nextStatus });
      return;
    }
    applyStatus(appointment, nextStatus);
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState title="Could not load appointments" description={loadError} icon={CalendarDays}>
        <Button onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Bookings
          </p>
          <h2 className="mt-2 text-h2">Appointments</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Review customer bookings for your services. Confirm, complete, cancel, or reject
            appointments — only bookings for your own services are shown.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {message ? (
        <p className="rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-sm font-medium text-teal-deep">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'all', label: 'All bookings' },
          { key: 'pending', label: 'Pending' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'completed', label: 'Completed' },
        ].map((item) => (
          <div key={item.key} className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
            <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">{item.label}</p>
            <p className="mt-0.5 text-lg font-bold text-ink">{statusCounts[item.key] || 0}</p>
          </div>
        ))}
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveStatus(filter.id)}
                aria-pressed={activeStatus === filter.id}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeStatus === filter.id
                    ? 'bg-teal-deep text-white'
                    : 'border border-line bg-white text-ink-soft hover:border-teal-200 hover:text-teal-deep'
                }`}
              >
                {filter.label}
                {statusCounts[filter.id] != null ? (
                  <span className="ml-1.5 opacity-70">{statusCounts[filter.id]}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, service, reference…"
              className="field py-2 pr-3 pl-9 text-sm"
              aria-label="Search appointments"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={appointments.length === 0 ? 'No appointments yet' : 'No matching appointments'}
              description={
                appointments.length === 0
                  ? 'Bookings for your published services will appear here once customers reserve them.'
                  : 'Try a different status filter or search term.'
              }
              icon={Clock}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base min-w-[900px]">
                <thead>
                  <tr className="table-head">
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Service</th>
                    <th className="px-5 py-3.5">Schedule</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const ref = item.reference || item.id;
                    const current = normalizeAppointmentStatus(item.status);
                    const actions = allowedAdminTransitions(current);
                    const busy = updatingRef === ref;
                    return (
                      <tr key={ref} className="border-b border-line/80 last:border-0 hover:bg-surface/60">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-ink">{item.customer || 'Customer'}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">{item.customerEmail || item.email || '—'}</p>
                          {item.customerPhone || item.phone ? (
                            <p className="text-xs text-ink-soft">{item.customerPhone || item.phone}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-ink">{item.service}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">{ref}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="block text-ink">{formatDate(item.date)}</span>
                          <span className="text-xs text-ink-soft">{item.time}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {actions.length === 0 ? (
                              <span className="text-xs text-ink-soft">No actions</span>
                            ) : (
                              actions.map((next) => {
                                const Icon = ACTION_ICONS[next] || Check;
                                const destructive = next === 'cancelled' || next === 'rejected';
                                return (
                                  <button
                                    key={next}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => requestChange(item, next)}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                                      destructive
                                        ? 'border-red-100 bg-white text-red-600 hover:bg-red-50'
                                        : 'border-teal-100 bg-teal-50 text-teal-deep hover:bg-teal-100'
                                    }`}
                                  >
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {ACTION_LABELS[next] || appointmentStatusLabel(next)}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line/80 md:hidden">
              {filtered.map((item) => {
                const ref = item.reference || item.id;
                const current = normalizeAppointmentStatus(item.status);
                const actions = allowedAdminTransitions(current);
                const parts = dateParts(item.date);
                const busy = updatingRef === ref;
                return (
                  <li key={ref} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-deep text-white">
                        <span className="text-[10px] font-bold tracking-wide uppercase">{parts.weekday}</span>
                        <span className="text-lg leading-none font-bold">{parts.day}</span>
                        <span className="text-[10px] font-medium">{parts.month}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold text-ink">{item.service}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-soft">
                          {item.customer || 'Customer'} · {item.time}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-soft">{ref}</p>
                      </div>
                    </div>
                    {actions.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/80 pt-3">
                        {actions.map((next) => {
                          const Icon = ACTION_ICONS[next] || Check;
                          const destructive = next === 'cancelled' || next === 'rejected';
                          return (
                            <button
                              key={next}
                              type="button"
                              disabled={busy}
                              onClick={() => requestChange(item, next)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                                destructive
                                  ? 'border-red-100 bg-white text-red-600 hover:bg-red-50'
                                  : 'border-teal-100 bg-teal-50 text-teal-deep hover:bg-teal-100'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {ACTION_LABELS[next] || appointmentStatusLabel(next)}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface/50 px-4 py-2.5 text-[11px] text-ink-soft">
          <span>{filtered.length} shown</span>
          <span>Customer contact details are visible only for bookings on your services.</span>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingChange)}
        onClose={() => setPendingChange(null)}
        onConfirm={() =>
          pendingChange && applyStatus(pendingChange.appointment, pendingChange.nextStatus)
        }
        title={`${pendingChange?.nextStatus === 'rejected' ? 'Reject' : 'Cancel'} appointment`}
        description={`${
          pendingChange?.nextStatus === 'rejected' ? 'Reject' : 'Cancel'
        } ${pendingChange?.appointment?.reference || ''} for ${
          pendingChange?.appointment?.customer || 'this customer'
        }? This cannot be undone.`}
        confirmLabel={pendingChange?.nextStatus === 'rejected' ? 'Reject appointment' : 'Cancel appointment'}
        loading={Boolean(updatingRef)}
      />
    </div>
  );
}
