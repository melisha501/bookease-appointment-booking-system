// Booking — 4-step booking flow connected to the backend API.
// Availability is loaded from /api/appointments/availability (working hours + booked slots).
// Bookings are saved to PostgreSQL via POST /api/appointments.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Clock, User, CalendarDays } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { useDemo } from '../store/DemoContext';

const steps = [
  { id: 1, label: 'Select Service' },
  { id: 2, label: 'Select Specialist' },
  { id: 3, label: 'Date & Time' },
  { id: 4, label: 'Summary' },
];

// Local calendar date (YYYY-MM-DD). Using toISOString() would shift the date
// for users east of UTC late in the day, wrongly disabling "today".
function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SpecialistAvatar({ specialist }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = typeof specialist?.image === 'string' ? specialist.image.trim() : '';
  const initial = (specialist?.name || '?').trim().slice(0, 1).toUpperCase() || '?';

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={specialist?.name || 'Specialist'}
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg font-bold text-teal-deep ring-1 ring-teal-100"
    >
      {initial}
    </span>
  );
}

export default function Booking() {
  const [searchParams] = useSearchParams();
  const { services, specialists, user, isLoggedIn, catalogLoading, catalogError, refreshCatalog } = useDemo();
  const serviceList = Array.isArray(services) ? services : [];
  const specialistList = Array.isArray(specialists) ? specialists : [];

  const preselectedService = searchParams.get('service') || '';
  const preselectedSpecialist = searchParams.get('specialist') || '';

  const [step, setStep] = useState(() => (preselectedService ? 2 : 1));
  const [serviceId, setServiceId] = useState(() => preselectedService);
  const [specialistId, setSpecialistId] = useState('');
  const [preferredSpecialistId, setPreferredSpecialistId] = useState(() => preselectedSpecialist);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [detailsUser, setDetailsUser] = useState(user);

  // When auth state resolves (or the user object refreshes), backfill any
  // fields the visitor has not edited yet. Render-time sync avoids an extra
  // effect render pass.
  if (user && user !== detailsUser) {
    setDetailsUser(user);
    setDetails((current) => ({
      name: current.name || user.name || '',
      email: current.email || user.email || '',
      phone: current.phone || user.phone || '',
    }));
  }

  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // appointment object from API

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsClosed, setSlotsClosed] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState('');

  const selectedService = useMemo(
    () => (Array.isArray(services) ? services : []).find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );
  const availableSpecialists = useMemo(() => {
    const list = Array.isArray(specialists) ? specialists : [];
    if (!selectedService) return list;
    const assigned = list.filter(
      (s) => Array.isArray(s.serviceIds) && s.serviceIds.includes(selectedService.id)
    );
    return assigned.length ? assigned : list;
  }, [specialists, selectedService]);
  const selectedSpecialist = useMemo(
    () => (Array.isArray(specialists) ? specialists : []).find((s) => s.id === specialistId) || null,
    [specialists, specialistId]
  );

  // Apply preselected specialist from URL when catalog data is available.
  useEffect(() => {
    if (!preferredSpecialistId) return;
    const list = Array.isArray(specialists) ? specialists : [];
    if (!list.length) return;
    const found = list.find((s) => s.id === preferredSpecialistId);
    if (!found) return;
    if (selectedService) {
      const compatible = availableSpecialists.some((s) => s.id === found.id);
      if (compatible) setSpecialistId(found.id);
    } else {
      setSpecialistId(found.id);
    }
  }, [preferredSpecialistId, specialists, selectedService, availableSpecialists]);

  // Keep specialist selection valid when service changes.
  useEffect(() => {
    if (!specialistId) return;
    if (!selectedService) return;
    const compatible = availableSpecialists.some((s) => s.id === specialistId);
    if (!compatible) {
      setSpecialistId('');
      setDate('');
      setTime('');
    }
  }, [selectedService, availableSpecialists, specialistId]);

  // Load availability from backend when specialist/date/service changes.
  // serviceId is required because slots are generated using the service duration.
  useEffect(() => {
    let alive = true;
    async function loadSlots() {
      if (!selectedService || !selectedSpecialist || !date) {
        setSlots([]);
        setSlotsClosed(false);
        setSlotsMessage('');
        return;
      }
      setSlotsLoading(true);
      setSlotsMessage('');
      try {
        const data = await api.get(
          `/appointments/availability?specialistId=${encodeURIComponent(selectedSpecialist.id)}&serviceId=${encodeURIComponent(selectedService.id)}&date=${encodeURIComponent(date)}`
        );
        if (!alive) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
        setSlotsClosed(Boolean(data?.closed));
        setSlotsMessage(data?.reason || '');
      } catch (err) {
        if (!alive) return;
        setSlots([]);
        setSlotsClosed(false);
        setSlotsMessage(err?.message || 'Could not load available time slots.');
      } finally {
        if (alive) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => {
      alive = false;
    };
  }, [selectedService, selectedSpecialist, date]);

  const prettyDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  // Computed once per mount so the date input's `min` is stable during render.
  const [today] = useState(toDateInputValue);
  const bookedCount = slots.filter((s) => s.taken).length;

  const canContinue = () => {
    if (step === 1) return Boolean(selectedService);
    if (step === 2) return Boolean(selectedSpecialist);
    if (step === 3) {
      if (!date || !time) return false;
      const current = slots.find((s) => s.slot === time);
      return Boolean(current?.available);
    }
    return true;
  };

  const validateDetails = () => {
    if (!details.name.trim()) return 'Please enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(details.email)) return 'Please enter a valid email.';
    if (details.phone.replace(/\D/g, '').length < 10) return 'Please enter a valid phone number (at least 10 digits).';
    return '';
  };

  const handleConfirm = async () => {
    const err = validateDetails();
    if (err) {
      setError(err);
      setStep(3);
      return;
    }
    if (!selectedService || !selectedSpecialist || !date || !time) {
      setError('Please complete all booking steps.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/appointments', {
        serviceId: selectedService.id,
        specialistId: selectedSpecialist.id,
        date,
        time,
        customerName: details.name.trim(),
        customerEmail: details.email.trim(),
        customerPhone: details.phone.trim(),
        notes: notes.trim(),
      });
      setConfirmed(data?.appointment || null);
    } catch (e) {
      const msg = e?.message || 'Booking failed. Please try again.';
      setError(msg);
      // If slot conflict, refresh availability (duration-based)
      if (e?.status === 409 || /no longer available/i.test(msg)) {
        setTime('');
        try {
          const data = await api.get(
            `/appointments/availability?specialistId=${encodeURIComponent(selectedSpecialist.id)}&serviceId=${encodeURIComponent(selectedService.id)}&date=${encodeURIComponent(date)}`
          );
          setSlots(Array.isArray(data?.slots) ? data.slots : []);
        } catch {
          // ignore
        }
        setStep(3);
      }
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep(1);
    setServiceId('');
    setSpecialistId('');
    setPreferredSpecialistId('');
    setDate('');
    setTime('');
    setNotes('');
    setConfirmed(null);
    setSlots([]);
    setError('');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="page-hero text-center">
        <p className="text-sm font-semibold tracking-wide text-teal-deep uppercase">Booking flow</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Book an Appointment</h1>
        <p className="mx-auto mt-3 max-w-2xl text-ink-soft">
          4 simple steps. {isLoggedIn ? `Booking as ${user?.name}.` : 'You can book as a guest — or log in for faster booking.'}
        </p>
      </div>

      {/* Stepper */}
      <div className="mt-10">
        <ol className="flex items-center gap-1 sm:gap-3">
          {steps.map((item, index) => {
            const isActive = step === item.id;
            const isDone = step > item.id || (confirmed && item.id === 4);
            return (
              <li key={item.id} className="flex flex-1 items-center gap-3">
                <span className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isDone ? 'bg-teal-deep text-white' : isActive ? 'bg-teal-brand text-white' : 'border border-line bg-white text-ink-soft'
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : item.id}
                  </span>
                  <span className={`hidden text-sm font-semibold sm:block ${isActive ? 'text-ink' : 'text-ink-soft'}`}>{item.label}</span>
                </span>
                {index < steps.length - 1 && <span className="mx-1 h-px flex-1 bg-line" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </div>

      <Card className="mt-8">
        {confirmed ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-deep">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-ink">Booking Confirmed</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              Your appointment request has been saved. Status: <span className="font-bold text-ink">Pending</span>.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-xs font-bold tracking-widest text-ink-soft uppercase">Booking Reference</p>
              <p className="mt-1 text-2xl font-bold tracking-widest text-teal-deep">{confirmed.reference || confirmed.id}</p>
              <p className="mt-1 text-xs text-ink-soft">Please save this reference for your records.</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button to="/customer/appointments">View My Appointments</Button>
              <Button variant="secondary" onClick={startOver}>New Booking</Button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            {catalogError && (serviceList.length > 0 || specialistList.length > 0) ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Some catalog data could not be refreshed. {catalogError}{' '}
                <button type="button" onClick={refreshCatalog} className="font-semibold underline">
                  Retry
                </button>
              </div>
            ) : null}

            {/* Step 1 */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold text-ink">Select a Service</h2>
                <p className="mt-1 text-sm text-ink-soft">Choose one service to book.</p>
                {catalogLoading && serviceList.length === 0 ? (
                  <p className="mt-6 text-sm text-ink-soft">Loading services…</p>
                ) : serviceList.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title={catalogError ? 'Could not load services' : 'No services available'}
                      description={
                        catalogError ||
                        'There are no services to book right now. Please check back later or contact the business.'
                      }
                      icon={CalendarDays}
                    >
                      {catalogError ? (
                        <Button onClick={refreshCatalog} variant="secondary">Try again</Button>
                      ) : null}
                    </EmptyState>
                  </div>
                ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {serviceList.map((service) => {
                    const selected = serviceId === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setServiceId(service.id);
                          const preferred = preferredSpecialistId
                            ? specialistList.find((s) => s.id === preferredSpecialistId)
                            : null;
                          const compatible = preferred && Array.isArray(preferred.serviceIds) && preferred.serviceIds.includes(service.id);
                          setSpecialistId(compatible ? preferred.id : '');
                          if (!compatible) setPreferredSpecialistId('');
                          setDate('');
                          setTime('');
                        }}
                        aria-pressed={selected}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          selected ? 'border-teal-deep bg-teal-50 ring-1 ring-teal-deep' : 'border-line bg-white hover:border-teal-brand'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-ink">{service.name}</p>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-teal-deep bg-teal-deep text-white' : 'border-line bg-white text-transparent'}`} aria-hidden="true">
                            <Check className="h-3 w-3" />
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{service.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <span className="font-bold text-teal-deep">{service.price}</span>
                          <span className="flex items-center gap-1 text-ink-soft"><Clock className="h-4 w-4" />{service.duration} mins</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold text-ink">Select a Specialist</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {selectedService
                    ? `Specialists available for ${selectedService.name}${selectedSpecialist ? `. ${selectedSpecialist.name} is selected.` : ''}`
                    : 'Choose who you would like to see.'}
                </p>
                {catalogLoading && specialistList.length === 0 ? (
                  <p className="mt-6 text-sm text-ink-soft">Loading specialists…</p>
                ) : availableSpecialists.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title={catalogError ? 'Could not load specialists' : 'No specialists available'}
                      description={
                        catalogError ||
                        'No specialists are available for this service right now. Please choose another service or check back later.'
                      }
                      icon={User}
                    >
                      {catalogError ? (
                        <Button onClick={refreshCatalog} variant="secondary">Try again</Button>
                      ) : null}
                      <Button onClick={() => setStep(1)} variant="secondary">Change service</Button>
                    </EmptyState>
                  </div>
                ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {availableSpecialists.map((specialist) => {
                    const selected = specialistId === specialist.id;
                    return (
                      <button
                        key={specialist.id}
                        type="button"
                        onClick={() => { setSpecialistId(specialist.id); setDate(''); setTime(''); }}
                        aria-pressed={selected}
                        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                          selected ? 'border-teal-deep bg-teal-50 ring-1 ring-teal-deep' : 'border-line bg-white hover:border-teal-brand'
                        }`}
                      >
                        <SpecialistAvatar specialist={specialist} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-ink">{specialist.name}</p>
                          <p className="truncate text-sm text-teal-deep">{specialist.title}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-soft">{specialist.specialty}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold text-ink">Select Date &amp; Time</h2>
                <p className="mt-1 text-sm text-ink-soft">Available slots are calculated from the specialist&apos;s schedule and existing bookings.</p>

                <div className="mt-6">
                  <label htmlFor="booking-date" className="mb-1.5 block text-sm font-semibold text-ink">Date</label>
                  <input
                    id="booking-date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setTime('');
                      setError('');
                    }}
                    className="input-modern sm:max-w-xs"
                  />
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft"><CalendarDays className="h-3.5 w-3.5" /> Past dates are disabled.</p>
                </div>

                <p className="mt-6 mb-2 text-sm font-semibold text-ink">Available time slots</p>
                {!date ? (
                  <p className="text-sm text-ink-soft">Please pick a date first.</p>
                ) : slotsLoading ? (
                  <p className="text-sm text-ink-soft">Loading available slots…</p>
                ) : slotsClosed ? (
                  <EmptyState
                    title="No available slots"
                    description={slotsMessage || `${selectedSpecialist?.name || 'This specialist'} is not available on the selected date.`}
                    icon={Clock}
                  />
                ) : slots.length === 0 ? (
                  <EmptyState title="No available slots" description={slotsMessage || 'No slots available for this date.'} icon={Clock} />
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map(({ slot, available, taken, inBreak, pastToday }) => {
                      const selected = time === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!available}
                          onClick={() => setTime(slot)}
                          aria-pressed={selected}
                          title={taken ? 'Already booked' : inBreak ? 'Break time' : pastToday ? 'Time has passed' : slot}
                          className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                            selected
                              ? 'bg-teal-deep text-white'
                              : available
                                ? 'border border-line bg-white text-ink hover:bg-slate-100'
                                : 'cursor-not-allowed border border-line bg-surface text-slate-400 line-through'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
                {date && bookedCount > 0 && (
                  <p className="mt-3 text-xs text-ink-soft">{bookedCount} slot(s) already booked and cannot be selected.</p>
                )}

                {/* Customer details */}
                <div className="mt-8 border-t border-line pt-6">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink"><User className="h-5 w-5 text-teal-deep" /> Your Details</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="c-name" className="mb-1.5 block text-sm font-semibold text-ink">Full Name</label>
                      <input id="c-name" type="text" required value={details.name} onChange={(e) => setDetails((c) => ({ ...c, name: e.target.value }))} placeholder="Your full name" className="input-modern" />
                    </div>
                    <div>
                      <label htmlFor="c-email" className="mb-1.5 block text-sm font-semibold text-ink">Email</label>
                      <input id="c-email" type="email" required value={details.email} onChange={(e) => setDetails((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" className="input-modern" />
                    </div>
                    <div>
                      <label htmlFor="c-phone" className="mb-1.5 block text-sm font-semibold text-ink">Phone</label>
                      <input id="c-phone" type="tel" required value={details.phone} onChange={(e) => setDetails((c) => ({ ...c, phone: e.target.value }))} placeholder="98XXXXXXXX" className="input-modern" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="c-notes" className="mb-1.5 block text-sm font-semibold text-ink">Additional Notes <span className="font-normal text-ink-soft">(optional)</span></label>
                    <textarea id="c-notes" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the specialist should know? (optional)" className="input-modern min-h-24 resize-y" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div>
                <h2 className="text-lg font-bold text-ink">Booking Summary</h2>
                <p className="mt-1 text-sm text-ink-soft">Please check your details before confirming.</p>

                <dl className="mt-6 divide-y divide-line rounded-2xl border border-line">
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Service</dt><dd className="min-w-0 text-right text-sm font-bold text-ink">{selectedService?.name}</dd></div>
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Specialist</dt><dd className="min-w-0 text-right text-sm font-bold text-ink">{selectedSpecialist?.name}</dd></div>
                  <div className="flex items-center justify-between px-5 py-4"><dt className="text-sm text-ink-soft">Date</dt><dd className="text-sm font-bold text-ink">{prettyDate}</dd></div>
                  <div className="flex items-center justify-between px-5 py-4"><dt className="text-sm text-ink-soft">Time</dt><dd className="text-sm font-bold text-ink">{time}</dd></div>
                  <div className="flex items-center justify-between px-5 py-4"><dt className="text-sm text-ink-soft">Duration</dt><dd className="text-sm font-bold text-ink">{selectedService?.duration} mins</dd></div>
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Customer</dt><dd className="min-w-0 break-words text-right text-sm font-bold text-ink">{details.name}</dd></div>
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Email</dt><dd className="min-w-0 break-all text-right text-sm font-bold text-ink">{details.email}</dd></div>
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Phone</dt><dd className="min-w-0 break-words text-right text-sm font-bold text-ink">{details.phone}</dd></div>
                  <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-ink-soft">Notes</dt><dd className="text-right text-sm font-medium text-ink">{notes || '—'}</dd></div>
                  <div className="flex items-center justify-between px-5 py-4"><dt className="text-sm font-semibold text-ink">Total</dt><dd className="text-lg font-bold text-teal-deep">{selectedService?.price}</dd></div>
                </dl>

                <p className="mt-4 text-xs text-ink-soft">
                  Your booking will be saved in the system. Cancellations are allowed only more than 24 hours before the appointment.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
              <Button variant="secondary" disabled={step === 1 || loading} onClick={() => setStep((v) => Math.max(1, v - 1))}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              {step < 4 ? (
                <Button disabled={!canContinue() || loading || slotsLoading} onClick={() => { setError(''); setStep(step + 1); }}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleConfirm} disabled={loading}>
                  <Check className="h-4 w-4" /> {loading ? 'Processing…' : 'Confirm Booking'}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <p className="mt-4 text-center text-xs text-ink-soft">
        Need to see your bookings? <Link to="/customer/appointments" className="font-semibold text-teal-deep hover:underline">View My Appointments</Link> (login required).
      </p>
    </div>
  );
}
