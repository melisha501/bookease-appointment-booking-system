// AdminAppointments — view and manage all appointments (backend API, admin only).
// Only transitions permitted by the backend are offered: pending can be approved,
// rejected, or cancelled; confirmed can be completed or cancelled.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Check,
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
  ADMIN_TRANSITIONS,
  APPOINTMENT_STATUS,
  appointmentStatusLabel,
  normalizeAppointmentStatus,
} from '../utils/appointmentStatus';

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const filters = [
  { id: 'all', label: 'All' },
  { id: APPOINTMENT_STATUS.PENDING, label: 'Pending' },
  { id: APPOINTMENT_STATUS.CONFIRMED, label: 'Confirmed' },
  { id: APPOINTMENT_STATUS.COMPLETED, label: 'Completed' },
  { id: APPOINTMENT_STATUS.CANCELLED, label: 'Cancelled' },
  { id: APPOINTMENT_STATUS.REJECTED, label: 'Rejected' },
];

function actionMeta(to) {
  if (to === APPOINTMENT_STATUS.CONFIRMED) {
    return { label: 'Approve', icon: Check, className: 'text-teal-deep', variant: 'soft' };
  }
  if (to === APPOINTMENT_STATUS.REJECTED) {
    return { label: 'Reject', icon: X, className: 'text-red-600', variant: 'danger' };
  }
  if (to === APPOINTMENT_STATUS.COMPLETED) {
    return { label: 'Complete', icon: Check, className: 'text-teal-deep', variant: 'soft' };
  }
  if (to === APPOINTMENT_STATUS.CANCELLED) {
    return { label: 'Cancel', icon: X, className: 'text-amber-700', variant: 'secondary' };
  }
  return {
    label: appointmentStatusLabel(to),
    icon: Check,
    className: 'text-ink-soft',
    variant: 'secondary',
  };
}

function CountTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold tracking-wide text-ink-soft uppercase">{label}</p>
        <p className="text-lg leading-tight font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [note, setNote] = useState('');
  const [busyRef, setBusyRef] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const mountedRef = useRef(true);
  const noteTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    };
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api.get('/appointments');
      if (mountedRef.current) {
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || 'Failed to load appointments.');
        if (!silent) setAppointments([]);
      }
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text) => {
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    setNote(text);
    noteTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setNote('');
    }, 3500);
  };

  const update = async (ref, next, label) => {
    setBusyRef(ref);
    setError('');
    try {
      const data = await api.patch(`/appointments/${encodeURIComponent(ref)}/status`, { status: next });
      flash(data?.message || `${ref} updated to ${label.toLowerCase()}.`);
      await load({ silent: true });
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Failed to update status.');
    } finally {
      if (mountedRef.current) setBusyRef('');
    }
  };

  const requestUpdate = (ref, next, label) => {
    if (next === APPOINTMENT_STATUS.REJECTED || next === APPOINTMENT_STATUS.CANCELLED) {
      setPendingAction({ ref, next, label });
      return;
    }
    update(ref, next, label);
  };

  const counts = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    const base = { all: list.length };
    for (const filter of filters) {
      if (filter.id === 'all') continue;
      base[filter.id] = list.filter((item) => normalizeAppointmentStatus(item.status) === filter.id).length;
    }
    return base;
  }, [appointments]);

  const filtered = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    const term = search.trim().toLowerCase();
    return list.filter((a) => {
      const ref = a.reference || a.id || '';
      const okSearch =
        !term ||
        String(a.service || '').toLowerCase().includes(term) ||
        String(a.specialist || '').toLowerCase().includes(term) ||
        String(a.customer || a.customerName || '').toLowerCase().includes(term) ||
        String(a.email || a.customerEmail || '').toLowerCase().includes(term) ||
        String(ref).toLowerCase().includes(term);
      const okStatus = status === 'all' || normalizeAppointmentStatus(a.status) === status;
      return okSearch && okStatus;
    });
  }, [appointments, search, status]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.time || '').localeCompare(String(a.time || ''));
      }),
    [filtered]
  );

  const pendingActionMessage = pendingAction
    ? pendingAction.next === APPOINTMENT_STATUS.REJECTED
      ? `Reject ${pendingAction.ref}? The customer will see this appointment as rejected.`
      : `Cancel ${pendingAction.ref}? The customer will see this appointment as cancelled.`
    : '';

  return (
    <div className="space-y-6">
      {/* Page intro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Operations
          </p>
          <h2 className="mt-2 text-h2">Appointment requests</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Approve new requests, mark completed visits, and keep customers informed about every
            booking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {note ? (
            <span
              role="status"
              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-deep"
            >
              {note}
            </span>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile
          icon={CalendarDays}
          label="Total"
          value={loading ? '—' : counts.all}
          tone="bg-teal-50 text-teal-deep ring-teal-100/70"
        />
        <CountTile
          icon={CalendarClock}
          label="Pending"
          value={loading ? '—' : counts[APPOINTMENT_STATUS.PENDING]}
          tone="bg-amber-50 text-amber-700 ring-amber-100"
        />
        <CountTile
          icon={CalendarCheck2}
          label="Confirmed"
          value={loading ? '—' : counts[APPOINTMENT_STATUS.CONFIRMED]}
          tone="bg-emerald-50 text-emerald-700 ring-emerald-100"
        />
        <CountTile
          icon={CalendarX2}
          label="Closed"
          value={
            loading
              ? '—'
              : counts[APPOINTMENT_STATUS.COMPLETED] +
                counts[APPOINTMENT_STATUS.CANCELLED] +
                counts[APPOINTMENT_STATUS.REJECTED]
          }
          tone="bg-slate-100 text-slate-600 ring-slate-200/70"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => load()}>
            Try again
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, service or reference…"
            aria-label="Search appointments"
            className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-teal-brand focus:ring-4 focus:ring-teal-100/70"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {filters.map((f) => {
            const active = status === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatus(f.id)}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-teal-deep text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,0.8)]'
                    : 'border border-line bg-white text-ink-soft hover:border-slate-300 hover:bg-slate-50 hover:text-ink'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink-soft'
                  }`}
                >
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
          <span>
            Showing <span className="font-bold text-ink">{sorted.length}</span> of{' '}
            <span className="font-bold text-ink">{counts.all}</span> appointments
          </span>
          {(search || status !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('all');
              }}
              className="font-semibold text-teal-deep hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {loading ? (
        <Card padding="p-0" className="overflow-hidden">
          <div className="animate-pulse divide-y divide-line">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-56 rounded bg-slate-100" />
                </div>
                <div className="hidden h-3 w-24 rounded bg-slate-100 sm:block" />
                <div className="h-6 w-20 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </Card>
      ) : sorted.length === 0 ? (
        appointments.length === 0 ? (
          <EmptyState
            title="No appointments yet"
            description="Appointments will appear here as soon as customers book a service."
            icon={CalendarDays}
          >
            <Button to="/booking">Create a test booking</Button>
          </EmptyState>
        ) : (
          <EmptyState
            title="No appointments match your filters"
            description="Try a different search term or status filter."
            icon={Search}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatus('all');
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        )
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Specialist</th>
                  <th className="px-5 py-3">Schedule</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const ref = a.reference || a.id;
                  const isBusy = busyRef === ref;
                  const current = normalizeAppointmentStatus(a.status);
                  const transitions = ADMIN_TRANSITIONS[current] || [];
                  return (
                    <tr key={ref} className="border-b border-line align-top transition last:border-0 hover:bg-surface/70">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-semibold text-ink">{ref}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{a.customer || a.customerName || '—'}</p>
                        <p className="text-xs text-ink-soft">{a.email || a.customerEmail || ''}</p>
                        <p className="text-xs text-ink-soft">{a.phone || a.customerPhone || ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{a.service || '—'}</p>
                        {a.notes ? (
                          <p className="mt-1 line-clamp-2 max-w-[220px] text-xs leading-relaxed text-ink-soft">
                            “{a.notes}”
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-ink-soft">{a.specialist || '—'}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-semibold text-ink">{formatDate(a.date)}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-soft">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {a.time || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-5 py-4">
                        {transitions.length === 0 ? (
                          <span className="block text-right text-xs text-ink-soft">No actions</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1.5">
                            {transitions.map((next) => {
                              const meta = actionMeta(next);
                              const Icon = meta.icon;
                              return (
                                <button
                                  key={next}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => requestUpdate(ref, next, meta.label)}
                                  aria-label={`${meta.label} appointment ${ref}`}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    meta.variant === 'danger'
                                      ? 'text-red-600 hover:bg-red-50'
                                      : meta.variant === 'soft'
                                        ? 'text-teal-deep hover:bg-teal-50'
                                        : 'text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {meta.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line bg-surface/50 px-5 py-2.5 text-[11px] text-ink-soft sm:hidden">
            Swipe the table sideways to see actions.
          </p>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          if (!pendingAction) return;
          const action = pendingAction;
          setPendingAction(null);
          await update(action.ref, action.next, action.label);
        }}
        title={`${pendingAction?.label || 'Update'} appointment`}
        description={pendingActionMessage}
        confirmLabel={pendingAction?.label || 'Confirm'}
        tone="danger"
        loading={Boolean(busyRef)}
      />
    </div>
  );
}



