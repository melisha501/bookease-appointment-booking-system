// BookingDetails — full details for one appointment, loaded from the backend.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  CreditCard,
  Hash,
  Image as ImageIcon,
  Info,
  Mail,
  Phone,
  Timer,
  UserRound,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { canCancelAppointment, useDemo } from '../store/DemoContext';

function ServiceThumb({ service }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = typeof service?.image === 'string' ? service.image.trim() : '';

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={service?.name || 'Service'}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-40 w-full shrink-0 rounded-2xl object-cover ring-1 ring-line sm:h-32 sm:w-44"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-32 w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 via-white to-slate-100 text-ink-soft sm:w-44"
    >
      <ImageIcon className="h-7 w-7 text-teal-brand/70" />
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

const STATUS_COPY = {
  pending: 'Your request is waiting for the studio to confirm it. You will be notified once it is reviewed.',
  confirmed: 'Your appointment is confirmed. Please arrive about 5 minutes early.',
  completed: 'This appointment is completed. Thank you for visiting!',
  cancelled: 'This appointment was cancelled. You can book a new one anytime.',
  rejected: 'This request was declined. Try another time or contact the studio for help.',
};

function Timeline({ status }) {
  const isCancelled = status === 'cancelled' || status === 'rejected';
  const steps = [
    { key: 'requested', label: 'Requested', done: true },
    {
      key: 'confirmed',
      label: 'Confirmed',
      done: status === 'confirmed' || status === 'completed',
    },
    { key: 'completed', label: 'Completed', done: status === 'completed' },
  ];

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700">
        This appointment is closed as <strong>{status}</strong>.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-start gap-3">
          <span className="relative flex flex-col items-center">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                step.done
                  ? 'bg-teal-deep text-white'
                  : 'border border-line bg-white text-ink-soft'
              }`}
            >
              {step.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span
                className={`mt-1 h-5 w-px ${step.done ? 'bg-teal-200' : 'bg-line'}`}
                aria-hidden="true"
              />
            ) : null}
          </span>
          <span className="pt-0.5">
            <span className={`block text-sm font-semibold ${step.done ? 'text-ink' : 'text-ink-soft'}`}>
              {step.label}
            </span>
            <span className="block text-[11px] text-ink-soft">
              {step.key === 'requested'
                ? 'Booking submitted'
                : step.key === 'confirmed'
                  ? 'Approved by the studio'
                  : 'Visit finished'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function BookingDetails() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || searchParams.get('id') || '';
  const { services, specialists } = useDemo();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/appointments/mine');
      const list = Array.isArray(data?.appointments) ? data.appointments : [];
      const found =
        list.find((item) => (item.reference || item.id) === ref) || (ref ? null : list[0]) || null;
      setAppointment(found);
    } catch (err) {
      setError(err?.message || 'Failed to load appointment details.');
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  const service = useMemo(() => {
    if (!appointment) return null;
    return (
      (Array.isArray(services) ? services : []).find(
        (item) =>
          (appointment.serviceId && item.id === appointment.serviceId) ||
          item.name === appointment.service
      ) || null
    );
  }, [appointment, services]);

  const provider = useMemo(() => {
    if (!appointment) return null;
    return (
      (Array.isArray(specialists) ? specialists : []).find(
        (item) => item.name === appointment.specialist
      ) || null
    );
  }, [appointment, specialists]);

  const appointmentRef = appointment?.reference || appointment?.id;
  const rule = appointment ? canCancelAppointment(appointment) : { allowed: false };
  const statusKey = String(appointment?.status || '').toLowerCase();
  const parts = dateParts(appointment?.date);
  const customerEmail =
    appointment?.customerEmail || appointment?.email || appointment?.customer?.email || '';
  const customerPhone =
    appointment?.customerPhone || appointment?.phone || appointment?.customer?.phone || '';

  const payment = {
    method: 'Pay at location',
    status:
      statusKey === 'completed'
        ? 'Paid'
        : statusKey === 'cancelled' || statusKey === 'rejected'
          ? 'Not applicable'
          : 'Pay at appointment',
    total: service ? service.price : '—',
  };

  const handleCancel = async () => {
    if (!appointmentRef) return;
    setMessage('');
    setError('');
    setBusy(true);
    try {
      await api.patch(`/appointments/${encodeURIComponent(appointmentRef)}/cancel`, {});
      setMessage('Appointment cancelled.');
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setConfirmOpen(false);
      setError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-36 w-full rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="skeleton h-56 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
          </div>
          <div className="space-y-5">
            <div className="skeleton h-40 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <EmptyState title="Could not load appointment" description={error} icon={CalendarDays}>
        <Button to="/customer/appointments" variant="secondary">
          Back to my appointments
        </Button>
      </EmptyState>
    );
  }

  if (!appointment) {
    return (
      <EmptyState
        title="Booking not found"
        description="This appointment could not be found in your account."
        icon={CalendarDays}
      >
        <Button to="/customer/appointments" variant="secondary">
          Back to my appointments
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/customer/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to my appointments
        </Link>
        <StatusBadge status={appointment.status} />
      </div>

      {message ? (
        <p
          role="status"
          className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep"
        >
          {message}
        </p>
      ) : null}
      {error && appointment ? (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
      {!ref ? (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs text-ink-soft">
          <Info className="h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
          Showing your most recent appointment. Pick a booking from the list to see a different one.
        </p>
      ) : null}

      {/* Summary banner */}
      <section className="relative overflow-hidden rounded-2xl border border-line/80 bg-white p-5 shadow-card sm:p-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(520px 200px at 96% 0%, rgba(20,184,166,0.1), transparent 62%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-deep text-white">
              <span className="text-[10px] font-bold tracking-wide uppercase">{parts.weekday}</span>
              <span className="text-xl leading-none font-bold">{parts.day}</span>
              <span className="text-[10px] font-medium">{parts.month}</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-h3">{appointment.service}</h2>
              <p className="mt-0.5 truncate text-sm text-ink-soft">with {appointment.specialist}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(appointment.date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {appointment.time}
                </span>
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-line bg-surface/70 px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.14em] text-ink-soft uppercase">
              Reference
            </p>
            <p className="mt-0.5 text-sm font-bold tracking-wider text-ink">{appointmentRef}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="surface-card p-5 sm:p-6">
            <h3 className="text-base font-bold text-ink">Appointment information</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Reference
                  </dt>
                  <dd className="break-all text-sm font-semibold text-ink">{appointmentRef}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Date
                  </dt>
                  <dd className="text-sm font-semibold text-ink">{formatDate(appointment.date)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Time
                  </dt>
                  <dd className="text-sm font-semibold text-ink">{appointment.time || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Customer
                  </dt>
                  <dd className="break-words text-sm font-semibold text-ink">
                    {appointment.customer || appointment.customerName || '—'}
                  </dd>
                </div>
              </div>
              {customerEmail ? (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                      Email
                    </dt>
                    <dd className="break-all text-sm font-semibold text-ink">{customerEmail}</dd>
                  </div>
                </div>
              ) : null}
              {customerPhone ? (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                      Phone
                    </dt>
                    <dd className="text-sm font-semibold text-ink">{customerPhone}</dd>
                  </div>
                </div>
              ) : null}
            </dl>

            {appointment.notes ? (
              <div className="mt-5 rounded-xl border border-line/80 bg-surface/60 p-3.5">
                <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{appointment.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Service details</h3>
              {service ? (
                <Link
                  to={`/services/${service.id}`}
                  className="text-sm font-semibold text-teal-deep hover:underline"
                >
                  View service
                </Link>
              ) : null}
            </div>
            {service ? (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <ServiceThumb service={service} />
                <div className="min-w-0">
                  <p className="font-bold text-ink">{service.name}</p>
                  {service.categoryName ? (
                    <p className="mt-1 text-[11px] font-bold tracking-wide text-teal-deep uppercase">
                      {service.categoryName}
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                    {service.description}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <Timer className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                      {service.duration ? `${service.duration} min` : 'Flexible'}
                    </span>
                    <span className="font-bold text-teal-deep">{service.price}</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">{appointment.service}</p>
            )}
          </section>

          <section className="surface-card p-5 sm:p-6">
            <h3 className="text-base font-bold text-ink">Actions</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              You can cancel only when more than 24 hours remain before the appointment. After that,
              please contact the studio.
            </p>
            {!rule.allowed && rule.reason ? (
              <p
                role="note"
                className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800"
              >
                {rule.reason}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                variant="danger"
                disabled={!rule.allowed || busy}
                onClick={() => setConfirmOpen(true)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel appointment
              </Button>
              <Button to="/booking" variant="secondary">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Book another
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="text-base font-bold text-ink">Provider</h3>
            <div className="mt-3 flex items-center gap-3">
              {provider?.image ? (
                <img
                  src={provider.image}
                  alt={provider.name}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {appointment.specialist || 'Specialist'}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {provider?.title || provider?.specialty || 'Your provider'}
                </p>
              </div>
            </div>
            {provider ? (
              <Link
                to={`/specialists/${provider.id}`}
                className="mt-3 inline-flex text-sm font-semibold text-teal-deep hover:underline"
              >
                View profile
              </Link>
            ) : null}
          </section>

          <section className="surface-card p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <CreditCard className="h-4 w-4 text-teal-deep" aria-hidden="true" />
              Payment
            </h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">Method</dt>
                <dd className="font-semibold text-ink">{payment.method}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">Status</dt>
                <dd className="font-semibold text-ink">{payment.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-base font-bold text-teal-deep">{payment.total}</dd>
              </div>
            </dl>
          </section>

          <section className="surface-card p-5">
            <h3 className="text-base font-bold text-ink">Status</h3>
            <div className="mt-2">
              <StatusBadge status={appointment.status} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {STATUS_COPY[statusKey] || 'Status information is unavailable for this booking.'}
            </p>
            <div className="mt-4 border-t border-line/80 pt-4">
              <Timeline status={statusKey} />
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleCancel}
        loading={busy}
        title="Cancel this appointment?"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep appointment"
      >
        <p>
          You are about to cancel <strong className="text-ink">{appointment.service}</strong> on{' '}
          <strong className="text-ink">{formatDate(appointment.date)}</strong> at{' '}
          <strong className="text-ink">{appointment.time}</strong>.
        </p>
        <p className="mt-2 text-xs">This cannot be undone. You can always book a new time.</p>
      </ConfirmDialog>
    </div>
  );
}
