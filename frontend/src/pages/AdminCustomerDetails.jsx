// AdminCustomerDetails — full profile and appointment history for one customer.
// Data comes from the admin-only /api/customers/:id and
// /api/customers/:id/appointments endpoints.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
  XCircle,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import {
  APPOINTMENT_STATUS_VALUES,
  STATUS_LABELS,
} from '../utils/appointmentStatus';

const HISTORY_PAGE_SIZE = 10;

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAppointmentDate(value) {
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

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

const emptyPagination = {
  page: 1,
  limit: HISTORY_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export default function AdminCustomerDetails() {
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState('');
  const [customerReloadKey, setCustomerReloadKey] = useState(0);

  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(emptyPagination);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadCustomer() {
      setCustomerLoading(true);
      setCustomerError('');
      try {
        const data = await api.get(`/customers/${encodeURIComponent(id)}`);
        if (alive) setCustomer(data?.customer || null);
      } catch (err) {
        if (!alive) return;
        setCustomerError(err?.message || 'Failed to load customer details.');
        setCustomer(null);
      } finally {
        if (alive) setCustomerLoading(false);
      }
    }

    if (id) loadCustomer();
    return () => {
      alive = false;
    };
  }, [id, customerReloadKey]);

  useEffect(() => {
    let alive = true;

    async function loadAppointments() {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        params.set('page', String(page));
        params.set('limit', String(HISTORY_PAGE_SIZE));

        const data = await api.get(
          `/customers/${encodeURIComponent(id)}/appointments?${params.toString()}`
        );
        if (!alive) return;
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
        setSummary(data?.summary || null);
        setPagination(data?.pagination || emptyPagination);
      } catch (err) {
        if (!alive) return;
        setHistoryError(err?.message || 'Failed to load appointment history.');
        setAppointments([]);
        setPagination(emptyPagination);
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }

    if (id) loadAppointments();
    return () => {
      alive = false;
    };
  }, [id, status, page, historyReloadKey]);

  const historyFilters = useMemo(
    () => [
      { id: 'all', label: 'All', count: summary?.total ?? pagination.total },
      ...APPOINTMENT_STATUS_VALUES.map((value) => ({
        id: value,
        label: STATUS_LABELS[value],
        count: summary?.[value] ?? 0,
      })),
    ],
    [summary, pagination.total]
  );

  const totalAppointments = customer?.totalAppointments ?? summary?.total ?? 0;

  if (customerLoading) {
    return <p className="text-sm text-ink-soft">Loading customer details…</p>;
  }

  if (customerError) {
    return (
      <div className="space-y-4">
        <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <span>{customerError}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCustomerReloadKey((key) => key + 1);
              setHistoryReloadKey((key) => key + 1);
            }}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <EmptyState
          title="Customer not found"
          description="This customer may have been removed, or the link is invalid."
          icon={UserRound}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <Card padding="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-xl font-bold text-teal-deep">
              {initials(customer.name)}
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">{customer.name}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Registered customer</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Email</p>
                <p className="break-all font-medium text-ink">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Phone</p>
                <p className="font-medium text-ink">{customer.phone || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Address</p>
                <p className="font-medium text-ink">{customer.address || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Registered</p>
                <p className="font-medium text-ink">{formatTimestamp(customer.registeredAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total appointments" value={totalAppointments} icon={CalendarDays} />
        <StatCard title="Upcoming" value={customer.upcomingAppointments || 0} subtitle="Pending or confirmed" icon={Clock} />
        <StatCard title="Completed" value={customer.completedAppointments || 0} icon={CheckCircle2} />
        <StatCard title="Cancelled" value={customer.cancelledAppointments || 0} icon={XCircle} />
      </div>

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Appointment history</h3>
            <p className="text-sm text-ink-soft">
              {totalAppointments === 1 ? '1 appointment on record' : `${totalAppointments} appointments on record`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHistoryReloadKey((key) => key + 1)}
            disabled={historyLoading}
          >
            <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {historyFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                setStatus(filter.id);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                status === filter.id
                  ? 'bg-teal-deep text-white'
                  : 'border border-line bg-white text-ink-soft hover:bg-slate-100 hover:text-ink'
              }`}
            >
              {filter.label} <span className={status === filter.id ? 'text-teal-100' : 'text-slate-400'}>({filter.count})</span>
            </button>
          ))}
        </div>
      </Card>

      {historyError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <span>{historyError}</span>
          <Button variant="secondary" size="sm" onClick={() => setHistoryReloadKey((key) => key + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!historyError && (historyLoading ? (
        <Card padding="p-0" className="overflow-hidden">
          <div className="animate-pulse divide-y divide-line">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 flex-1 rounded bg-slate-100" />
                <div className="hidden h-3 w-24 rounded bg-slate-100 sm:block" />
                <div className="h-6 w-20 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </Card>
      ) : appointments.length === 0 ? (
        <EmptyState
          title={status === 'all' ? 'No appointments yet' : 'No appointments with this status'}
          description={
            status === 'all'
              ? 'This customer has not booked an appointment yet.'
              : 'Try another status filter to see more of this customer’s history.'
          }
          icon={CalendarDays}
        >
          {status !== 'all' && (
            <Button variant="secondary" onClick={() => { setStatus('all'); setPage(1); }}>
              Show all appointments
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Specialist</th>
                  <th className="px-5 py-3">Date &amp; Time</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.reference || appointment.id} className="border-b border-line align-top last:border-0 hover:bg-surface">
                    <td className="px-5 py-4 font-semibold whitespace-nowrap text-ink">
                      {appointment.reference || appointment.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-ink">{appointment.service}</td>
                    <td className="px-5 py-4 text-ink-soft">{appointment.specialist}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                      {formatAppointmentDate(appointment.date)}
                      <br />
                      {appointment.time}
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={appointment.status} /></td>
                    <td className="px-5 py-4 text-ink-soft">
                      {appointment.notes ? (
                        <span className="line-clamp-2 max-w-[220px]">“{appointment.notes}”</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {!historyError && !historyLoading && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Page <span className="font-bold text-ink">{pagination.page}</span> of{' '}
            <span className="font-bold text-ink">{pagination.totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
