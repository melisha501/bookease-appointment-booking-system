// My Appointments — loads the logged-in customer's appointments from the backend.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Search, X } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { canCancelAppointment } from '../store/DemoContext';

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
];

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/appointments/mine');
      setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load appointments.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter((item) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        String(item.service || '').toLowerCase().includes(term) ||
        String(item.specialist || '').toLowerCase().includes(term) ||
        String(item.reference || item.id || '').toLowerCase().includes(term);
      const matchesStatus = activeStatus === 'all' || item.status === activeStatus;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, activeStatus]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [filtered]
  );

  const handleCancel = async (ref) => {
    setMessage('');
    setError('');
    setBusyId(ref);
    try {
      await api.patch(`/appointments/${encodeURIComponent(ref)}/cancel`, {});
      setMessage('Appointment cancelled.');
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Showing <span className="font-bold text-ink">{sorted.length}</span> of {appointments.length} appointments
        </p>
        <Button to="/booking" size="sm">
          <CalendarDays className="h-4 w-4" /> New Appointment
        </Button>
      </div>

      {message && <p role="status" className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
      {loadError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{loadError}</p>}

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service, provider or reference…"
            aria-label="Search appointments"
            className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-teal-brand focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveStatus(filter.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeStatus === filter.id ? 'bg-teal-deep text-white' : 'border border-line bg-white text-ink-soft hover:bg-slate-100 hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading your appointments…</p>
      ) : sorted.length === 0 ? (
        <EmptyState title="No appointments found" description="Book a service to see your appointments here." icon={CalendarDays}>
          <Button to="/booking">Book Appointment</Button>
        </EmptyState>
      ) : (
        <>
          <Card padding="p-0" className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Provider</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Cancel</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const ref = item.reference || item.id;
                    const rule = canCancelAppointment(item);
                    return (
                      <tr key={ref} className="border-b border-line last:border-0 hover:bg-surface">
                        <td className="px-5 py-4 font-semibold text-ink">{ref}</td>
                        <td className="px-5 py-4 font-medium text-ink">{item.service}</td>
                        <td className="px-5 py-4 text-ink-soft">{item.specialist}</td>
                        <td className="px-5 py-4 text-ink-soft">{formatDate(item.date)}</td>
                        <td className="px-5 py-4 text-ink-soft">{item.time}</td>
                        <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                        <td className="px-5 py-4">
                          <Link to={`/customer/appointments/details?ref=${ref}`} className="font-semibold whitespace-nowrap text-teal-deep hover:underline">View Details</Link>
                        </td>
                        <td className="px-5 py-4">
                          {rule.allowed ? (
                            <button type="button" disabled={busyId === ref} onClick={() => handleCancel(ref)} className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline disabled:opacity-50">
                              <X className="h-4 w-4" /> {busyId === ref ? 'Cancelling…' : 'Cancel'}
                            </button>
                          ) : (
                            <span className="text-xs text-ink-soft" title={rule.reason}>Not allowed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 md:hidden">
            {sorted.map((item) => {
              const ref = item.reference || item.id;
              const rule = canCancelAppointment(item);
              return (
                <Card key={ref} padding="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{item.service}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{ref} · with {item.specialist}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between"><dt className="text-ink-soft">Date</dt><dd className="font-semibold text-ink">{formatDate(item.date)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-soft">Time</dt><dd className="font-semibold text-ink">{item.time}</dd></div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Link to={`/customer/appointments/details?ref=${ref}`} className="text-sm font-semibold text-teal-deep hover:underline">View Details →</Link>
                    {rule.allowed && (
                      <button type="button" disabled={busyId === ref} onClick={() => handleCancel(ref)} className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50">
                        {busyId === ref ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
