// AdminAppointments — view and manage all appointments (backend API, admin only).
// Only transitions permitted by the backend are offered: pending can be approved,
// rejected, or cancelled; confirmed can be completed or cancelled.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
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
    return { label: 'Approve', icon: Check, className: 'text-teal-deep' };
  }
  if (to === APPOINTMENT_STATUS.REJECTED) {
    return { label: 'Reject', icon: X, className: 'text-red-600' };
  }
  if (to === APPOINTMENT_STATUS.COMPLETED) {
    return { label: 'Mark Completed', icon: Check, className: 'text-teal-deep' };
  }
  if (to === APPOINTMENT_STATUS.CANCELLED) {
    return { label: 'Cancel', icon: X, className: 'text-amber-700' };
  }
  return { label: appointmentStatusLabel(to), icon: Check, className: 'text-ink-soft' };
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [note, setNote] = useState('');
  const [busyRef, setBusyRef] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/appointments');
      if (mountedRef.current) {
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || 'Failed to load appointments.');
        setAppointments([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (text) => {
    setNote(text);
    window.setTimeout(() => setNote(''), 3000);
  };

  const update = async (ref, next, label) => {
    setBusyRef(ref);
    setError('');
    try {
      const data = await api.patch(`/appointments/${encodeURIComponent(ref)}/status`, { status: next });
      flash(data?.message || `${ref} → ${label}`);
      await load();
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Failed to update status.');
    } finally {
      if (mountedRef.current) setBusyRef('');
    }
  };

  const filtered = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter((a) => {
      const term = search.trim().toLowerCase();
      const ref = a.reference || a.id || '';
      const okSearch =
        !term ||
        String(a.service || '').toLowerCase().includes(term) ||
        String(a.specialist || '').toLowerCase().includes(term) ||
        String(a.customer || a.customerName || '').toLowerCase().includes(term) ||
        String(ref).toLowerCase().includes(term);
      const okStatus = status === 'all' || normalizeAppointmentStatus(a.status) === status;
      return okSearch && okStatus;
    });
  }, [appointments, search, status]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [filtered]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-bold text-ink">{sorted.length}</span> appointments
        </p>
        {note && <p role="status" className="rounded-full bg-teal-50 px-4 py-1.5 text-xs font-semibold text-teal-deep">{note}</p>}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, service or reference…" aria-label="Search appointments" className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-teal-brand focus:ring-2 focus:ring-teal-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f.id} type="button" onClick={() => setStatus(f.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${status === f.id ? 'bg-teal-deep text-white' : 'border border-line bg-white text-ink-soft hover:bg-slate-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading appointments…</p>
      ) : sorted.length === 0 ? (
        appointments.length === 0 ? (
          <EmptyState title="No appointments yet" description="Appointments will appear here after customers book." icon={Search} />
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                  <th className="px-5 py-3">Ref</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Specialist</th>
                  <th className="px-5 py-3">Date &amp; Time</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const ref = a.reference || a.id;
                  const isBusy = busyRef === ref;
                  const current = normalizeAppointmentStatus(a.status);
                  const transitions = ADMIN_TRANSITIONS[current] || [];
                  return (
                    <tr key={ref} className="border-b border-line align-top last:border-0 hover:bg-surface">
                      <td className="px-5 py-4 font-semibold text-ink">{ref}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{a.customer || a.customerName}</p>
                        <p className="text-xs text-ink-soft">{a.email || a.customerEmail || ''}</p>
                        <p className="text-xs text-ink-soft">{a.phone || a.customerPhone || ''}</p>
                      </td>
                      <td className="px-5 py-4">{a.service}{a.notes ? <p className="mt-1 max-w-[220px] text-xs text-ink-soft">“{a.notes}”</p> : null}</td>
                      <td className="px-5 py-4 text-ink-soft">{a.specialist}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-ink-soft">{formatDate(a.date)}<br />{a.time}</td>
                      <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                      <td className="px-5 py-4">
                        {transitions.length === 0 ? (
                          <span className="text-xs text-ink-soft">No actions</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {transitions.map((next) => {
                              const meta = actionMeta(next);
                              const Icon = meta.icon;
                              return (
                                <button
                                  key={next}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => update(ref, next, meta.label)}
                                  className={`inline-flex items-center gap-1 text-xs font-bold hover:underline disabled:opacity-50 ${meta.className}`}
                                >
                                  <Icon className="h-3.5 w-3.5" /> {meta.label}
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
        </Card>
      )}
    </div>
  );
}
