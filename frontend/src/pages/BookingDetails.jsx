// BookingDetails — details for one appointment (loaded from the backend).

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, CreditCard, Hash, Timer, User, X } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { canCancelAppointment } from '../store/DemoContext';
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

export default function BookingDetails() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || searchParams.get('id') || '';
  const { services } = useDemo();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/appointments/mine');
      const list = Array.isArray(data?.appointments) ? data.appointments : [];
      const found =
        list.find((item) => (item.reference || item.id) === ref) ||
        (ref ? null : list[0]) ||
        null;
      setAppointment(found);
    } catch (err) {
      setError(err?.message || 'Failed to load appointment details.');
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  if (loading) return <p className="text-sm text-ink-soft">Loading appointment details…</p>;

  if (error && !appointment) {
    return (
      <EmptyState title="Could not load appointment" description={error} icon={CalendarDays}>
        <Button to="/customer/appointments" variant="secondary">Back to My Appointments</Button>
      </EmptyState>
    );
  }

  if (!appointment) {
    return (
      <EmptyState title="Booking not found" description="This appointment could not be found in your account." icon={CalendarDays}>
        <Button to="/customer/appointments" variant="secondary">Back to My Appointments</Button>
      </EmptyState>
    );
  }

  const service = (Array.isArray(services) ? services : []).find((item) => item.name === appointment.service) || null;
  const rule = canCancelAppointment(appointment);
  const appointmentRef = appointment.reference || appointment.id;
  const payment = {
    method: 'Pay at location',
    status:
      appointment.status === 'completed'
        ? 'Paid'
        : appointment.status === 'cancelled' || appointment.status === 'rejected'
          ? 'Not applicable'
          : 'Pay at appointment',
    total: service ? service.price : '—',
  };

  const handleCancel = async () => {
    setMessage('');
    setError('');
    setBusy(true);
    try {
      await api.patch(`/appointments/${encodeURIComponent(appointmentRef)}/cancel`, {});
      setMessage('Appointment cancelled.');
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/customer/appointments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to My Appointments
        </Link>
        <StatusBadge status={appointment.status} />
      </div>

      {message && <p role="status" className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="text-base font-bold text-ink">Appointment Information</h3>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center gap-3"><Hash className="h-4 w-4 shrink-0 text-teal-deep" /><dt className="w-28 shrink-0 text-sm text-ink-soft">Reference</dt><dd className="text-sm font-bold text-ink">{appointmentRef}</dd></div>
              <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 shrink-0 text-teal-deep" /><dt className="w-28 shrink-0 text-sm text-ink-soft">Date</dt><dd className="text-sm font-semibold text-ink">{formatDate(appointment.date)}</dd></div>
              <div className="flex items-center gap-3"><Clock className="h-4 w-4 shrink-0 text-teal-deep" /><dt className="w-28 shrink-0 text-sm text-ink-soft">Time</dt><dd className="text-sm font-semibold text-ink">{appointment.time}</dd></div>
              <div className="flex items-center gap-3"><User className="h-4 w-4 shrink-0 text-teal-deep" /><dt className="w-28 shrink-0 text-sm text-ink-soft">Customer</dt><dd className="text-sm font-semibold text-ink">{appointment.customer || appointment.customerName}</dd></div>
              {appointment.notes ? (
                <div className="flex items-start gap-3 pt-1"><dt className="w-28 shrink-0 text-sm text-ink-soft">Notes</dt><dd className="text-sm text-ink">{appointment.notes}</dd></div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h3 className="text-base font-bold text-ink">Service Details</h3>
            {service ? (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <img src={service.image} alt={service.name} className="h-36 w-full shrink-0 rounded-2xl object-cover sm:h-32 sm:w-44" />
                <div>
                  <p className="font-bold text-ink">{service.name}</p>
                  <p className="mt-1 text-xs font-semibold tracking-wide text-teal-deep uppercase">{service.categoryName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{service.description}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                    <span className="flex items-center gap-1.5"><Timer className="h-4 w-4" />{service.duration} mins</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">{appointment.service}</p>
            )}
          </Card>

          <Card>
            <h3 className="text-base font-bold text-ink">Actions</h3>
            <p className="mt-2 text-sm text-ink-soft">
              24-hour rule: you can cancel only when more than 24 hours remain before the appointment.
            </p>
            {!rule.allowed && (
              <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">{rule.reason}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" disabled={!rule.allowed || busy} onClick={handleCancel} className={rule.allowed ? 'text-red-600' : ''}>
                <X className="h-4 w-4" /> {busy ? 'Cancelling…' : 'Cancel Appointment'}
              </Button>
              <Button to="/booking" variant="secondary">Book Another</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-base font-bold text-ink">Provider</h3>
            <p className="mt-3 text-sm font-semibold text-ink">{appointment.specialist}</p>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-base font-bold text-ink"><CreditCard className="h-5 w-5 text-teal-deep" /> Payment Information</h3>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between"><dt className="text-sm text-ink-soft">Method</dt><dd className="text-sm font-semibold text-ink">{payment.method}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-sm text-ink-soft">Status</dt><dd className="text-sm font-semibold text-ink">{payment.status}</dd></div>
              <div className="flex items-center justify-between border-t border-line pt-3"><dt className="text-sm font-semibold text-ink">Total</dt><dd className="text-base font-bold text-teal-deep">{payment.total}</dd></div>
            </dl>
          </Card>

          <Card>
            <h3 className="text-base font-bold text-ink">Appointment Status</h3>
            <div className="mt-3 flex items-center gap-2"><StatusBadge status={appointment.status} /></div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {appointment.status === 'confirmed' && 'Your appointment is confirmed. Please arrive 5 minutes early.'}
              {appointment.status === 'pending' && 'Your request is pending review.'}
              {appointment.status === 'completed' && 'This appointment is completed. Thank you for visiting!'}
              {appointment.status === 'cancelled' && 'This appointment was cancelled. You can book a new one anytime.'}
              {appointment.status === 'rejected' && 'This appointment request was rejected. You can book another time or contact us for help.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
