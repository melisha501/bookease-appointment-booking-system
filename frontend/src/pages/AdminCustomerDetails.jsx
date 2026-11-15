// AdminCustomerDetails — full profile and appointment history for one customer.
// Data comes from the admin-only /api/customers/:id and
// /api/customers/:id/appointments endpoints.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
  XCircle,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { APPOINTMENT_STATUS_VALUES, STATUS_LABELS } from '../utils/appointmentStatus';

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

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading customer details">
      <div className="skeleton h-4 w-32" />
      <div className="surface-card p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="skeleton h-20 w-20 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3.5 w-64" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}

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
    return <DetailSkeleton />;
  }

  if (customerError) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/customers"
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to customers
        </Link>
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{customerError}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCustomerReloadKey((key) => key + 1);
              setHistoryReloadKey((key) => key + 1);
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/customers"
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to customers
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/customers"
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-deep hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to customers
        </Link>
        <Badge variant="muted">Customer profile</Badge>
      </div>

      {/* Profile header */}
      <section className="surface-card relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            backgroundImage:
              'radial-gradient(520px 200px at 12% 0%, rgba(20,184,166,0.14), transparent 66%), radial-gradient(420px 180px at 92% 0%, rgba(15,118,110,0.1), transparent 62%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-deep text-2xl font-bold text-white shadow-lift ring-4 ring-white">
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                  {customer.name}
                </h2>
                <Badge variant="success" dot>
                  Registered
                </Badge>
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-ink-soft">
                <Mail className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                <span className="truncate">{customer.email}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                <CalendarDays className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                Joined {formatTimestamp(customer.registeredAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:min-w-[260px]">
            <div className="flex items-start gap-2.5 rounded-xl border border-line/80 bg-white/80 px-3.5 py-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-ink-soft uppercase">Phone</p>
                <p className="truncate text-sm font-semibold text-ink">
                  {customer.phone || 'Not provided'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-line/80 bg-white/80 px-3.5 py-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-ink-soft uppercase">Address</p>
                <p className="text-sm font-semibold break-words text-ink">
                  {customer.address || 'Not provided'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Total appointments" value={totalAppointments} icon={CalendarDays} />
        <StatCard
          title="Upcoming"
          value={customer.upcomingAppointments || 0}
          subtitle="Pending or confirmed"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          title="Completed"
          value={customer.completedAppointments || 0}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          title="Cancelled"
          value={customer.cancelledAppointments || 0}
          icon={XCircle}
          tone="rose"
        />
      </div>

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Appointment history</h3>
            <p className="text-sm text-ink-soft">
              {totalAppointments === 1
                ? '1 appointment on record'
                : `${totalAppointments} appointments on record`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHistoryReloadKey((key) => key + 1)}
            disabled={historyLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {historyFilters.map((filter) => {
            const active = status === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setStatus(filter.id);
                  setPage(1);
                }}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-teal-deep text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,0.8)]'
                    : 'border border-line bg-white text-ink-soft hover:border-slate-300 hover:bg-slate-50 hover:text-ink'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink-soft'
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {historyError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{historyError}</span>
          <Button variant="secondary" size="sm" onClick={() => setHistoryReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      )}

      {!historyError &&
        (historyLoading ? (
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
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('all');
                  setPage(1);
                }}
              >
                Show all appointments
              </Button>
            )}
          </EmptyState>
        ) : (
          <Card padding="p-0" className="overflow-hidden">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Specialist</th>
                    <th className="px-5 py-3">Schedule</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr
                      key={appointment.reference || appointment.id}
                      className="border-b border-line align-top transition last:border-0 hover:bg-surface/70"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold whitespace-nowrap text-ink">
                        {appointment.reference || appointment.id}
                      </td>
                      <td className="px-5 py-4 font-medium text-ink">{appointment.service}</td>
                      <td className="px-5 py-4 text-ink-soft">{appointment.specialist}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-semibold text-ink">
                          {formatAppointmentDate(appointment.date)}
                        </p>
                        <p className="text-xs text-ink-soft">{appointment.time}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={appointment.status} />
                      </td>
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
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
