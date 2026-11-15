// Booking — four-step appointment flow backed by the real API.
// Availability comes from /api/appointments/availability (working hours,
// breaks and existing bookings); bookings are saved via POST /api/appointments.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Mail,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useDemo } from '../store/DemoContext';

const STEPS = [
  { id: 1, label: 'Service', short: 'Service' },
  { id: 2, label: 'Specialist', short: 'Specialist' },
  { id: 3, label: 'Date & time', short: 'Schedule' },
  { id: 4, label: 'Review', short: 'Review' },
];

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLongDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function slotPeriod(slot) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(slot || '').trim());
  if (!match) return 'Available times';
  let hour = Number(match[1]) % 12;
  if ((match[3] || '').toUpperCase() === 'PM') hour += 12;
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

const PERIOD_META = {
  Morning: { icon: Sun, hint: 'Before noon' },
  Afternoon: { icon: Sunset, hint: '12:00 – 5:00 PM' },
  Evening: { icon: Moon, hint: 'After 5:00 PM' },
  'Available times': { icon: Clock, hint: '' },
};

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function SpecialistAvatar({ specialist, size = 'h-14 w-14' }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = typeof specialist?.image === 'string' ? specialist.image.trim() : '';

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={specialist?.name || 'Specialist'}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${size} shrink-0 rounded-full object-cover ring-1 ring-line`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-deep ring-1 ring-teal-100`}
    >
      {initials(specialist?.name)}
    </span>
  );
}

function StepHeading({ title, description, onBack, backLabel = 'Back' }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-h3">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-deep hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {backLabel}
        </button>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value, emphasis = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-ink-soft">{label}</dt>
      <dd
        className={`min-w-0 text-right text-xs ${
          emphasis ? 'font-bold text-teal-deep' : 'font-semibold text-ink'
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

export default function Booking() {
  const [searchParams] = useSearchParams();
  const {
    services,
    specialists,
    user,
    isLoggedIn,
    catalogLoading,
    catalogError,
    refreshCatalog,
  } = useDemo();
  const serviceList = useMemo(() => (Array.isArray(services) ? services : []), [services]);
  const specialistList = useMemo(() => (Array.isArray(specialists) ? specialists : []), [specialists]);

  const preselectedService = searchParams.get('service') || '';
  const preselectedSpecialist = searchParams.get('specialist') || '';

  const [step, setStep] = useState(() => (preselectedService ? 2 : 1));
  const [serviceId, setServiceId] = useState(() => preselectedService);
  const [specialistId, setSpecialistId] = useState('');
  const [preferredSpecialistId, setPreferredSpecialistId] = useState(() => preselectedSpecialist);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [specialistQuery, setSpecialistQuery] = useState('');

  const [details, setDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [detailsUser, setDetailsUser] = useState(user);
  const [fieldErrors, setFieldErrors] = useState({});

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const submittingRef = useRef(false);

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsClosed, setSlotsClosed] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState('');

  const [today] = useState(toDateInputValue);

  // Backfill details from the signed-in account without overwriting edits.
  if (user && user !== detailsUser) {
    setDetailsUser(user);
    setDetails((current) => ({
      name: current.name || user.name || '',
      email: current.email || user.email || '',
      phone: current.phone || user.phone || '',
    }));
  }

  const selectedService = useMemo(
    () => serviceList.find((service) => service.id === serviceId) || null,
    [serviceList, serviceId]
  );

  const availableSpecialists = useMemo(() => {
    if (!selectedService) return specialistList;
    const assigned = specialistList.filter(
      (specialist) =>
        Array.isArray(specialist.serviceIds) && specialist.serviceIds.includes(selectedService.id)
    );
    return assigned.length ? assigned : specialistList;
  }, [specialistList, selectedService]);

  const selectedSpecialist = useMemo(
    () => specialistList.find((specialist) => specialist.id === specialistId) || null,
    [specialistList, specialistId]
  );

  // Keep the URL-selected specialist when the catalog arrives, if compatible.
  useEffect(() => {
    if (!preferredSpecialistId) return;
    if (!specialistList.length) return;
    const found = specialistList.find((specialist) => specialist.id === preferredSpecialistId);
    if (!found) return;
    if (selectedService) {
      const compatible = availableSpecialists.some((specialist) => specialist.id === found.id);
      if (compatible) setSpecialistId(found.id);
    } else {
      setSpecialistId(found.id);
    }
  }, [preferredSpecialistId, specialistList, selectedService, availableSpecialists]);

  // A step is only reachable when the previous choices are still valid.
  useEffect(() => {
    if (step > 1 && !selectedService && !catalogLoading) setStep(1);
  }, [step, selectedService, catalogLoading]);

  useEffect(() => {
    if (!specialistId || !selectedService) return;
    const compatible = availableSpecialists.some((specialist) => specialist.id === specialistId);
    if (!compatible) {
      setSpecialistId('');
      setDate('');
      setTime('');
    }
  }, [selectedService, availableSpecialists, specialistId]);

  // Load availability whenever specialist, service or date changes.
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
          `/appointments/availability?specialistId=${encodeURIComponent(
            selectedSpecialist.id
          )}&serviceId=${encodeURIComponent(selectedService.id)}&date=${encodeURIComponent(date)}`
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

  const upcomingDates = useMemo(() => {
    const base = new Date(`${today}T00:00:00`);
    return Array.from({ length: 14 }).map((_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      return toDateInputValue(day);
    });
  }, [today]);

  const filteredServices = useMemo(() => {
    const term = serviceQuery.trim().toLowerCase();
    if (!term) return serviceList;
    return serviceList.filter((service) =>
      [service.name, service.description, service.categoryName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [serviceList, serviceQuery]);

  const filteredSpecialists = useMemo(() => {
    const term = specialistQuery.trim().toLowerCase();
    if (!term) return availableSpecialists;
    return availableSpecialists.filter((specialist) =>
      [specialist.name, specialist.title, specialist.specialty]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [availableSpecialists, specialistQuery]);

  const groupedSlots = useMemo(() => {
    const groups = new Map();
    slots.forEach((slot) => {
      const period = slotPeriod(slot.slot);
      if (!groups.has(period)) groups.set(period, []);
      groups.get(period).push(slot);
    });
    const order = ['Morning', 'Afternoon', 'Evening', 'Available times'];
    return order.filter((period) => groups.has(period)).map((period) => [period, groups.get(period)]);
  }, [slots]);

  const prettyDate = formatLongDate(date);
  const bookedCount = slots.filter((slot) => slot.taken).length;
  const availableCount = slots.filter((slot) => slot.available).length;
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  const validateDetails = () => {
    const next = {};
    if (!details.name.trim()) next.name = 'Enter your full name.';
    if (!EMAIL_RE.test(details.email.trim())) next.email = 'Enter a valid email address.';
    if (details.phone.replace(/\D/g, '').length < 10) {
      next.phone = 'Enter a phone number with at least 10 digits.';
    }
    return next;
  };

  const canContinue = () => {
    if (step === 1) return Boolean(selectedService);
    if (step === 2) return Boolean(selectedSpecialist);
    if (step === 3) {
      if (!date || !time) return false;
      const current = slots.find((slot) => slot.slot === time);
      return Boolean(current?.available);
    }
    return true;
  };

  const goToStep = (target) => {
    if (target < 1 || target > 4) return;
    if (target > step) return; // forward navigation always uses the Continue button
    setError('');
    setStep(target);
  };

  const handleNext = () => {
    setError('');
    if (step === 3) {
      const nextErrors = validateDetails();
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        setError('Please check your contact details before continuing.');
        return;
      }
    }
    if (!canContinue()) return;
    setStep((current) => Math.min(4, current + 1));
  };

  const handleConfirm = async () => {
    if (submittingRef.current || loading) return;

    const nextErrors = validateDetails();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please check your contact details before confirming.');
      setStep(3);
      return;
    }
    if (!selectedService || !selectedSpecialist || !date || !time) {
      setError('Please complete all booking steps.');
      return;
    }

    submittingRef.current = true;
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
      setModalOpen(true);
    } catch (e) {
      const message = e?.message || 'Booking failed. Please try again.';
      setError(message);
      if (e?.status === 409 || /no longer available/i.test(message)) {
        setTime('');
        try {
          const data = await api.get(
            `/appointments/availability?specialistId=${encodeURIComponent(
              selectedSpecialist.id
            )}&serviceId=${encodeURIComponent(selectedService.id)}&date=${encodeURIComponent(date)}`
          );
          setSlots(Array.isArray(data?.slots) ? data.slots : []);
        } catch {
          // The refreshed slot list is best-effort; the error above is enough.
        }
        setStep(3);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const startOver = () => {
    setModalOpen(false);
    setStep(1);
    setServiceId('');
    setSpecialistId('');
    setPreferredSpecialistId('');
    setDate('');
    setTime('');
    setNotes('');
    setServiceQuery('');
    setSpecialistQuery('');
    setConfirmed(null);
    setSlots([]);
    setSlotsClosed(false);
    setSlotsMessage('');
    setError('');
    setFieldErrors({});
  };

  const selectService = (service) => {
    setServiceId(service.id);
    setError('');
    const preferred = preferredSpecialistId
      ? specialistList.find((specialist) => specialist.id === preferredSpecialistId)
      : null;
    const compatible =
      preferred &&
      Array.isArray(preferred.serviceIds) &&
      preferred.serviceIds.includes(service.id);
    setSpecialistId(compatible ? preferred.id : '');
    if (!compatible) setPreferredSpecialistId('');
    setDate('');
    setTime('');
  };

  const detailSummary = confirmed
    ? {
        service: confirmed.service?.name || confirmed.serviceName || selectedService?.name,
        specialist: confirmed.specialist?.name || confirmed.specialistName || selectedSpecialist?.name,
        date: confirmed.date || date,
        time: confirmed.time || time,
        reference: confirmed.reference || confirmed.id,
      }
    : null;

  return (
    <div className="container-page py-8 sm:py-10 lg:py-12">
      <header className="mx-auto max-w-2xl text-center">
        <span className="eyebrow justify-center">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Booking flow
        </span>
        <h1 className="mt-3 text-h1">Book your appointment</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {isLoggedIn
            ? `Booking as ${user?.name || 'you'} — your details are pre-filled.`
            : 'Four quick steps. You can book as a guest, or log in for faster booking.'}
        </p>
      </header>

      {!confirmed ? (
        <>
          {/* Stepper */}
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="relative h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-teal-deep transition-all duration-300"
                style={{ width: `${Math.max(progress, 6)}%` }}
                aria-hidden="true"
              />
            </div>
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {STEPS.map((item) => {
                const isActive = step === item.id;
                const isDone = step > item.id;
                return (
                  <li key={item.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => goToStep(item.id)}
                      disabled={item.id > step}
                      aria-current={isActive ? 'step' : undefined}
                      className={`flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center transition sm:flex-row sm:justify-start sm:gap-2.5 sm:text-left ${
                        item.id < step
                          ? 'cursor-pointer text-ink hover:bg-white'
                          : item.id > step
                            ? 'cursor-default text-slate-400'
                            : 'text-ink'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition sm:h-9 sm:w-9 ${
                          isDone
                            ? 'bg-teal-deep text-white'
                            : isActive
                              ? 'bg-teal-brand text-white ring-4 ring-teal-100'
                              : 'border border-line bg-white text-ink-soft'
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : item.id}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-bold sm:text-[13px]">
                          {item.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Main panel */}
            <div className="surface-card overflow-hidden">
              <div className="p-5 sm:p-7">
                {error ? (
                  <div
                    role="alert"
                    className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="shrink-0 text-xs font-bold underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}

                {catalogError && (serviceList.length > 0 || specialistList.length > 0) ? (
                  <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                    <span>Some catalog data could not be refreshed. {catalogError}</span>
                    <button
                      type="button"
                      onClick={refreshCatalog}
                      className="shrink-0 font-semibold underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {/* Step 1 — service */}
                {step === 1 ? (
                  <div>
                    <StepHeading
                      title="Choose a service"
                      description="Pick the treatment you would like to book. You can change it later."
                    />

                    {serviceList.length > 6 ? (
                      <div className="relative mt-5">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={serviceQuery}
                          onChange={(event) => setServiceQuery(event.target.value)}
                          placeholder="Search services…"
                          aria-label="Search services for booking"
                          className="field py-2.5 pr-3 pl-10 text-[13px]"
                        />
                      </div>
                    ) : null}

                    {catalogLoading && serviceList.length === 0 ? (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="skeleton h-24 rounded-2xl" />
                        ))}
                      </div>
                    ) : serviceList.length === 0 ? (
                      <div className="mt-5">
                        <EmptyState
                          title={catalogError ? 'Could not load services' : 'No services available'}
                          description={
                            catalogError ||
                            'There are no services to book right now. Please check back later or contact the studio.'
                          }
                          icon={CalendarDays}
                        >
                          {catalogError ? (
                            <Button onClick={refreshCatalog} variant="secondary">
                              Try again
                            </Button>
                          ) : null}
                        </EmptyState>
                      </div>
                    ) : filteredServices.length === 0 ? (
                      <div className="mt-6 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-ink">No matching services</p>
                        <p className="mt-1 text-xs text-ink-soft">
                          Try a different keyword or clear the search.
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-4"
                          onClick={() => setServiceQuery('')}
                        >
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {filteredServices.map((service) => {
                          const selected = serviceId === service.id;
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => selectService(service)}
                              aria-pressed={selected}
                              className={`group relative flex gap-3 rounded-2xl border p-3.5 text-left transition duration-200 ${
                                selected
                                  ? 'border-teal-deep bg-teal-50/70 ring-1 ring-teal-deep'
                                  : 'border-line bg-white hover:border-teal-200 hover:bg-teal-50/30'
                              }`}
                            >
                              {service.image ? (
                                <img
                                  src={service.image}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-line"
                                />
                              ) : (
                                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                                  <CalendarCheck className="h-6 w-6" aria-hidden="true" />
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                {service.categoryName ? (
                                  <span className="block text-[10px] font-bold tracking-[0.1em] text-teal-deep uppercase">
                                    {service.categoryName}
                                  </span>
                                ) : null}
                                <span className="mt-0.5 block truncate text-sm font-bold text-ink">
                                  {service.name}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                                  <span className="font-bold text-teal-deep">
                                    {service.price || '—'}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                    {service.duration ? `${service.duration} min` : 'Flexible'}
                                  </span>
                                </span>
                              </span>
                              <span
                                aria-hidden="true"
                                className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${
                                  selected
                                    ? 'border-teal-deep bg-teal-deep text-white'
                                    : 'border-line bg-white text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Step 2 — specialist */}
                {step === 2 ? (
                  <div>
                    <StepHeading
                      title="Choose a specialist"
                      description={
                        selectedService
                          ? `Professionals available for ${selectedService.name}.`
                          : 'Choose who you would like to see.'
                      }
                      onBack={() => goToStep(1)}
                      backLabel="Change service"
                    />

                    {selectedService ? (
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-3.5 py-2.5">
                        <span className="min-w-0 truncate text-xs font-semibold text-teal-deep">
                          {selectedService.name} · {selectedService.duration || '—'} min ·{' '}
                          {selectedService.price}
                        </span>
                        <button
                          type="button"
                          onClick={() => goToStep(1)}
                          className="shrink-0 text-xs font-bold text-teal-deep hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}

                    {availableSpecialists.length > 6 ? (
                      <div className="relative mt-4">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={specialistQuery}
                          onChange={(event) => setSpecialistQuery(event.target.value)}
                          placeholder="Search specialists…"
                          aria-label="Search specialists for booking"
                          className="field py-2.5 pr-3 pl-10 text-[13px]"
                        />
                      </div>
                    ) : null}

                    {catalogLoading && specialistList.length === 0 ? (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="skeleton h-20 rounded-2xl" />
                        ))}
                      </div>
                    ) : availableSpecialists.length === 0 ? (
                      <div className="mt-5">
                        <EmptyState
                          title={catalogError ? 'Could not load specialists' : 'No specialists available'}
                          description={
                            catalogError ||
                            'No specialists are available for this service right now. Please choose another service or check back later.'
                          }
                          icon={UserRound}
                        >
                          <Button onClick={() => goToStep(1)} variant="secondary">
                            Change service
                          </Button>
                          {catalogError ? (
                            <Button onClick={refreshCatalog} variant="secondary">
                              Try again
                            </Button>
                          ) : null}
                        </EmptyState>
                      </div>
                    ) : filteredSpecialists.length === 0 ? (
                      <div className="mt-6 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-ink">No matching specialists</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-4"
                          onClick={() => setSpecialistQuery('')}
                        >
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {filteredSpecialists.map((specialist) => {
                          const selected = specialistId === specialist.id;
                          return (
                            <button
                              key={specialist.id}
                              type="button"
                              onClick={() => {
                                setSpecialistId(specialist.id);
                                setDate('');
                                setTime('');
                                setError('');
                              }}
                              aria-pressed={selected}
                              className={`group relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-200 ${
                                selected
                                  ? 'border-teal-deep bg-teal-50/70 ring-1 ring-teal-deep'
                                  : 'border-line bg-white hover:border-teal-200 hover:bg-teal-50/30'
                              }`}
                            >
                              <SpecialistAvatar specialist={specialist} />
                              <span className="min-w-0 flex-1 pr-5">
                                <span className="block truncate text-sm font-bold text-ink">
                                  {specialist.name}
                                </span>
                                <span className="block truncate text-xs font-semibold text-teal-deep">
                                  {specialist.title || specialist.specialty || 'Specialist'}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                                  {Number(specialist.experience) > 0 ? (
                                    <span>{specialist.experience} yrs experience</span>
                                  ) : null}
                                  {Number(specialist.rating) > 0 ? (
                                    <span className="font-semibold text-amber-700">
                                      ★ {specialist.rating}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              <span
                                aria-hidden="true"
                                className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${
                                  selected
                                    ? 'border-teal-deep bg-teal-deep text-white'
                                    : 'border-line bg-white text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Step 3 — date, time, details */}
                {step === 3 ? (
                  <div>
                    <StepHeading
                      title="Pick a date & time"
                      description="Availability is calculated from the specialist's schedule, breaks and existing bookings."
                      onBack={() => goToStep(2)}
                      backLabel="Change specialist"
                    />

                    <div className="mt-5">
                      <p className="field-label">Next 14 days</p>
                      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                        {upcomingDates.map((value) => {
                          const d = new Date(`${value}T00:00:00`);
                          const selected = date === value;
                          const isToday = value === today;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setDate(value);
                                setTime('');
                                setError('');
                              }}
                              aria-pressed={selected}
                              className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-2.5 py-2.5 transition ${
                                selected
                                  ? 'border-teal-deep bg-teal-deep text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,0.8)]'
                                  : 'border-line bg-white text-ink hover:border-teal-200 hover:bg-teal-50/40'
                              }`}
                            >
                              <span
                                className={`text-[10px] font-bold tracking-wide uppercase ${
                                  selected ? 'text-teal-50' : 'text-ink-soft'
                                }`}
                              >
                                {isToday
                                  ? 'Today'
                                  : d.toLocaleDateString(undefined, { weekday: 'short' })}
                              </span>
                              <span className="mt-0.5 text-lg font-bold leading-none">
                                {d.getDate()}
                              </span>
                              <span
                                className={`text-[10px] font-medium ${
                                  selected ? 'text-teal-50' : 'text-ink-soft'
                                }`}
                              >
                                {d.toLocaleDateString(undefined, { month: 'short' })}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label
                          htmlFor="booking-date"
                          className="flex items-center gap-2 text-xs font-medium text-ink-soft"
                        >
                          Or choose another date
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
                            className="field w-auto py-1.5 text-xs"
                          />
                        </label>
                        {date ? (
                          <p className="text-xs font-semibold text-ink">{prettyDate}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="field-label mb-0">Available times</p>
                        {date && !slotsLoading ? (
                          <p className="text-xs text-ink-soft" aria-live="polite">
                            {availableCount} available
                            {bookedCount > 0 ? ` · ${bookedCount} booked` : ''}
                          </p>
                        ) : null}
                      </div>

                      {!date ? (
                        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-5 text-center text-sm text-ink-soft">
                          Select a date to see open time slots.
                        </p>
                      ) : slotsLoading ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="skeleton h-10 rounded-xl" />
                          ))}
                        </div>
                      ) : slotsClosed || slots.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center">
                          <Clock className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                          <p className="mt-2 text-sm font-semibold text-ink">No available slots</p>
                          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-soft">
                            {slotsMessage ||
                              `${
                                selectedSpecialist?.name || 'This specialist'
                              } is not available on the selected date. Try another day.`}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-4">
                          {groupedSlots.map(([period, periodSlots]) => {
                            const meta = PERIOD_META[period] || PERIOD_META['Available times'];
                            const PeriodIcon = meta.icon;
                            return (
                              <div key={period}>
                                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-ink-soft uppercase">
                                  <PeriodIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {period}
                                  {meta.hint ? (
                                    <span className="font-medium normal-case tracking-normal text-slate-400">
                                      · {meta.hint}
                                    </span>
                                  ) : null}
                                </p>
                                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                  {periodSlots.map(({ slot, available, taken, inBreak, pastToday }) => {
                                    const selected = time === slot;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        disabled={!available}
                                        onClick={() => {
                                          setTime(slot);
                                          setError('');
                                        }}
                                        aria-pressed={selected}
                                        title={
                                          taken
                                            ? 'Already booked'
                                            : inBreak
                                              ? 'Break time'
                                              : pastToday
                                                ? 'Time has passed'
                                                : slot
                                        }
                                        className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                                          selected
                                            ? 'bg-teal-deep text-white shadow-[0_10px_20px_-14px_rgba(15,118,110,0.9)]'
                                            : available
                                              ? 'border border-line bg-white text-ink hover:border-teal-200 hover:bg-teal-50/50'
                                              : 'cursor-not-allowed border border-line bg-surface text-slate-400 line-through'
                                        }`}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                            Struck-through times are already booked, on a break, or in the past.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 border-t border-line pt-6">
                      <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                        <UserRound className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                        Your details
                      </h3>
                      <p className="mt-1 text-xs text-ink-soft">
                        {isLoggedIn
                          ? 'Pre-filled from your account — edit anything that has changed.'
                          : 'We use these details to confirm and remind you about the appointment.'}
                      </p>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="c-name" className="field-label">
                            Full name
                          </label>
                          <input
                            id="c-name"
                            type="text"
                            required
                            value={details.name}
                            onChange={(event) => {
                              setDetails((current) => ({ ...current, name: event.target.value }));
                              setFieldErrors((current) => ({ ...current, name: '' }));
                            }}
                            placeholder="Your full name"
                            autoComplete="name"
                            aria-invalid={Boolean(fieldErrors.name)}
                            className={`field ${fieldErrors.name ? 'border-red-300' : ''}`}
                          />
                          {fieldErrors.name ? (
                            <p className="field-error">{fieldErrors.name}</p>
                          ) : null}
                        </div>
                        <div>
                          <label htmlFor="c-phone" className="field-label">
                            Phone
                          </label>
                          <input
                            id="c-phone"
                            type="tel"
                            required
                            value={details.phone}
                            onChange={(event) => {
                              setDetails((current) => ({ ...current, phone: event.target.value }));
                              setFieldErrors((current) => ({ ...current, phone: '' }));
                            }}
                            placeholder="98XXXXXXXX"
                            autoComplete="tel"
                            aria-invalid={Boolean(fieldErrors.phone)}
                            className={`field ${fieldErrors.phone ? 'border-red-300' : ''}`}
                          />
                          {fieldErrors.phone ? (
                            <p className="field-error">{fieldErrors.phone}</p>
                          ) : null}
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="c-email" className="field-label">
                            Email
                          </label>
                          <input
                            id="c-email"
                            type="email"
                            required
                            value={details.email}
                            onChange={(event) => {
                              setDetails((current) => ({ ...current, email: event.target.value }));
                              setFieldErrors((current) => ({ ...current, email: '' }));
                            }}
                            placeholder="you@example.com"
                            autoComplete="email"
                            aria-invalid={Boolean(fieldErrors.email)}
                            className={`field ${fieldErrors.email ? 'border-red-300' : ''}`}
                          />
                          {fieldErrors.email ? (
                            <p className="field-error">{fieldErrors.email}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label htmlFor="c-notes" className="field-label">
                          Notes <span className="font-normal text-ink-soft">(optional)</span>
                        </label>
                        <textarea
                          id="c-notes"
                          rows="3"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Anything the specialist should know?"
                          className="field min-h-24 resize-y"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Step 4 — review */}
                {step === 4 ? (
                  <div>
                    <StepHeading
                      title="Review your booking"
                      description="Check everything below, then confirm. Nothing is charged online."
                      onBack={() => goToStep(3)}
                      backLabel="Edit details"
                    />

                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-line/80 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="icon-tile h-10 w-10">
                              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                                Service
                              </p>
                              <p className="truncate text-sm font-bold text-ink">
                                {selectedService?.name}
                              </p>
                              <p className="text-xs text-ink-soft">
                                {selectedService?.duration || '—'} min ·{' '}
                                {selectedService?.price}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(1)}
                            className="shrink-0 text-xs font-bold text-teal-deep hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-line/80 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <SpecialistAvatar specialist={selectedSpecialist} size="h-10 w-10" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                                Specialist
                              </p>
                              <p className="truncate text-sm font-bold text-ink">
                                {selectedSpecialist?.name}
                              </p>
                              <p className="truncate text-xs text-ink-soft">
                                {selectedSpecialist?.title || selectedSpecialist?.specialty}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            className="shrink-0 text-xs font-bold text-teal-deep hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-line/80 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="icon-tile h-10 w-10">
                              <Clock className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                                Date & time
                              </p>
                              <p className="text-sm font-bold text-ink">{prettyDate || '—'}</p>
                              <p className="text-xs text-ink-soft">
                                {time || '—'} · {selectedService?.duration || '—'} min
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(3)}
                            className="shrink-0 text-xs font-bold text-teal-deep hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-line/80 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="icon-tile h-10 w-10">
                              <UserRound className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                                Contact
                              </p>
                              <p className="truncate text-sm font-bold text-ink">
                                {details.name || '—'}
                              </p>
                              <p className="truncate text-xs text-ink-soft">{details.email}</p>
                              <p className="text-xs text-ink-soft">{details.phone}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(3)}
                            className="shrink-0 text-xs font-bold text-teal-deep hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {notes.trim() ? (
                        <div className="rounded-2xl border border-line/80 bg-white p-4">
                          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            Notes
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink">{notes}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex items-start gap-2 rounded-xl bg-teal-50/70 px-3.5 py-3 text-xs leading-relaxed text-teal-deep ring-1 ring-teal-100">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Your booking is saved as <strong>Pending</strong> until the studio confirms.
                        Free cancellation up to 24 hours before the appointment.
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Navigation footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-line/80 bg-surface/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <Button
                  variant="secondary"
                  disabled={step === 1 || loading}
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-xs font-medium text-ink-soft sm:hidden">
                    Step {step} of {STEPS.length}
                  </span>
                  {step < 4 ? (
                    <Button disabled={!canContinue() || loading || slotsLoading} onClick={handleNext}>
                      Continue
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button onClick={handleConfirm} loading={loading} disabled={loading}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {loading ? 'Confirming…' : 'Confirm booking'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky summary */}
            <aside className="lg:sticky lg:top-24">
              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-ink">Booking summary</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                    Step {step}/4
                  </span>
                </div>
                <dl className="mt-4 space-y-3">
                  <SummaryRow label="Service" value={selectedService?.name} />
                  <SummaryRow label="Specialist" value={selectedSpecialist?.name} />
                  <SummaryRow label="Date" value={date ? prettyDate : ''} />
                  <SummaryRow label="Time" value={time} />
                  <SummaryRow
                    label="Duration"
                    value={selectedService?.duration ? `${selectedService.duration} min` : ''}
                  />
                  <div className="border-t border-line/80 pt-3">
                    <SummaryRow
                      label="Total"
                      value={selectedService?.price || '—'}
                      emphasis
                    />
                  </div>
                </dl>

                <div className="mt-4 space-y-2 rounded-xl bg-surface/70 p-3 text-[11px] leading-relaxed text-ink-soft">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
                    No online payment required
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
                    Instant request, confirmed by the studio
                  </p>
                </div>

                {isLoggedIn ? (
                  <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-soft">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Updates go to {user?.email}
                  </p>
                ) : (
                  <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
                    <Link to="/login" className="font-semibold text-teal-deep hover:underline">
                      Log in
                    </Link>{' '}
                    to reuse your details and track this booking.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : (
        /* Inline success state after the modal is dismissed */
        <div className="mx-auto mt-10 max-w-xl">
          <div className="surface-card p-8 text-center sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-8 ring-teal-50/50">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-h2">Appointment requested</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Your booking has been saved as <strong className="text-ink">Pending</strong> until the
              studio confirms it.
            </p>
            <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-[10px] font-bold tracking-[0.16em] text-ink-soft uppercase">
                Booking reference
              </p>
              <p className="mt-1 text-xl font-bold tracking-widest text-teal-deep">
                {detailSummary?.reference || '—'}
              </p>
              <p className="mt-1 text-xs text-ink-soft">Please save this reference for your records.</p>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button to="/customer/appointments">View my appointments</Button>
              <Button variant="secondary" onClick={startOver}>
                Book another
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen && Boolean(confirmed)}
        onClose={() => setModalOpen(false)}
        title="Appointment requested"
        description="Your booking was saved successfully. The studio will confirm it shortly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button to="/customer/appointments">View my appointments</Button>
          </>
        }
      >
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-8 ring-teal-50/60">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.16em] text-ink-soft uppercase">
              Booking reference
            </p>
            <p className="mt-1 text-xl font-bold tracking-widest text-teal-deep">
              {detailSummary?.reference || '—'}
            </p>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-line rounded-2xl border border-line text-sm">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-ink-soft">Service</dt>
            <dd className="text-right font-semibold text-ink">{detailSummary?.service || '—'}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-ink-soft">Specialist</dt>
            <dd className="text-right font-semibold text-ink">{detailSummary?.specialist || '—'}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-ink-soft">When</dt>
            <dd className="text-right font-semibold text-ink">
              {formatLongDate(detailSummary?.date)} · {detailSummary?.time || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-ink-soft">Status</dt>
            <dd className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-100">
              Pending
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          Need to change something? Use the confirmation email or contact the studio with your
          reference. Cancellations are free up to 24 hours before the appointment.
        </p>
      </Modal>

      <p className="mt-6 text-center text-xs text-ink-soft">
        Need to see your bookings?{' '}
        <Link to="/customer/appointments" className="font-semibold text-teal-deep hover:underline">
          View my appointments
        </Link>{' '}
        (login required).
      </p>
    </div>
  );
}
