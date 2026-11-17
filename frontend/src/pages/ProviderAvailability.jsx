// ProviderAvailability — weekly working hours for the provider's bookable profile.
// Uses the same WorkingHour model and validation as the admin scheduling screen.

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarOff,
  Clock,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const DEFAULT_FORM = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  start: '09:00',
  end: '17:00',
  breakStart: '13:00',
  breakEnd: '14:00',
};

function labelTo24h(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let [, hour, minute, meridiem] = match;
  hour = Number(hour);
  if (meridiem.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function to24hToLabel(value) {
  if (!value) return '';
  const [hourRaw, minute] = String(value).split(':');
  let hour = Number(hourRaw);
  if (!Number.isFinite(hour) || !minute) return '';
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${meridiem}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProviderAvailability() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [specialistName, setSpecialistName] = useState('');
  const [exceptions, setExceptions] = useState([]);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/providers/me/availability');
      setSpecialistName(data?.specialistName || '');
      setExceptions(Array.isArray(data?.dateExceptions) ? data.dateExceptions : []);
      const schedule = data?.schedule;
      if (schedule) {
        setHasSchedule(true);
        setForm({
          days: Array.isArray(schedule.days) && schedule.days.length ? schedule.days : DEFAULT_FORM.days,
          start: labelTo24h(schedule.start || schedule.startTime) || DEFAULT_FORM.start,
          end: labelTo24h(schedule.end || schedule.endTime) || DEFAULT_FORM.end,
          breakStart: labelTo24h(schedule.breakStart),
          breakEnd: labelTo24h(schedule.breakEnd),
        });
      } else {
        setHasSchedule(false);
        setForm(DEFAULT_FORM);
      }
    } catch (err) {
      if (err?.data?.code === 'NO_PROVIDER_PROFILE' || err?.status === 404) {
        setLoadError('No provider profile is linked to this account.');
      } else {
        setLoadError(err?.message || 'Could not load your availability.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...DAYS.filter((item) => current.days.includes(item) || item === day)],
    }));
    if (status.message) setStatus({ type: '', message: '' });
  };

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (status.message) setStatus({ type: '', message: '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.days.length) {
      setStatus({ type: 'error', message: 'Select at least one working day.' });
      return;
    }
    if (!form.start || !form.end) {
      setStatus({ type: 'error', message: 'Opening and closing times are required.' });
      return;
    }
    if (Boolean(form.breakStart) !== Boolean(form.breakEnd)) {
      setStatus({ type: 'error', message: 'Set both break times or leave both empty.' });
      return;
    }

    setSaving(true);
    setStatus({ type: 'loading', message: 'Saving availability…' });
    try {
      const data = await api.put('/providers/me/availability', {
        days: form.days,
        startTime: to24hToLabel(form.start),
        endTime: to24hToLabel(form.end),
        breakStart: form.breakStart ? to24hToLabel(form.breakStart) : '',
        breakEnd: form.breakEnd ? to24hToLabel(form.breakEnd) : '',
      });
      setHasSchedule(true);
      setSpecialistName((current) => data?.specialistName || current);
      setStatus({ type: 'success', message: data?.message || 'Availability saved.' });
      load();
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not save availability.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
          <div className="skeleton h-96 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState title="Could not load availability" description={loadError} icon={Clock}>
        <Button onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
          Scheduling
        </p>
        <h2 className="mt-2 text-h2">Availability</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Customers can only book appointment slots inside these working hours. Save changes here
          and they apply immediately to your bookable profile.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">Weekly working hours</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                {specialistName ? `Bookable profile: ${specialistName}` : 'Your provider profile'}
              </p>
            </div>
            <Badge variant={hasSchedule ? 'success' : 'muted'}>
              {hasSchedule ? 'Schedule active' : 'No schedule yet'}
            </Badge>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-5">
            <div>
              <p className="field-label">Working days</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DAYS.map((day) => {
                  const active = form.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        active
                          ? 'border-teal-deep bg-teal-50 text-teal-deep'
                          : 'border-line bg-white text-ink-soft hover:border-teal-200'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                At least one working day is required while a schedule is active.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="availability-start" className="field-label">
                  Opening time
                </label>
                <input
                  id="availability-start"
                  type="time"
                  required
                  value={form.start}
                  onChange={(event) => update('start', event.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="availability-end" className="field-label">
                  Closing time
                </label>
                <input
                  id="availability-end"
                  type="time"
                  required
                  value={form.end}
                  onChange={(event) => update('end', event.target.value)}
                  className="field"
                />
              </div>
            </div>

            <div>
              <p className="field-label">Daily break (optional)</p>
              <div className="mt-1.5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="availability-break-start" className="sr-only">
                    Break start time
                  </label>
                  <input
                    id="availability-break-start"
                    type="time"
                    value={form.breakStart}
                    onChange={(event) => update('breakStart', event.target.value)}
                    className="field"
                    aria-label="Break start time"
                  />
                </div>
                <div>
                  <label htmlFor="availability-break-end" className="sr-only">
                    Break end time
                  </label>
                  <input
                    id="availability-break-end"
                    type="time"
                    value={form.breakEnd}
                    onChange={(event) => update('breakEnd', event.target.value)}
                    className="field"
                    aria-label="Break end time"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                Leave both empty if you do not take a scheduled break.
              </p>
            </div>

            {status.message ? (
              <p
                role="status"
                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                  status.type === 'error'
                    ? 'border border-red-100 bg-red-50 text-red-700'
                    : 'border border-teal-100 bg-teal-50 text-teal-deep'
                }`}
              >
                {status.message}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" loading={saving} disabled={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving…' : 'Save availability'}
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={load}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-base font-bold text-ink">Current schedule</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-soft">Working days</dt>
                <dd className="text-right font-semibold text-ink">
                  {form.days.length ? form.days.join(', ') : 'None selected'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="text-ink-soft">Hours</dt>
                <dd className="text-right font-semibold text-ink">
                  {to24hToLabel(form.start) || '—'} – {to24hToLabel(form.end) || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="text-ink-soft">Break</dt>
                <dd className="text-right font-semibold text-ink">
                  {form.breakStart && form.breakEnd
                    ? `${to24hToLabel(form.breakStart)} – ${to24hToLabel(form.breakEnd)}`
                    : 'No break'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
              Booking validation on the server uses these hours and your existing appointments.
            </p>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <CalendarOff className="h-5 w-5 text-teal-deep" aria-hidden="true" />
              Date exceptions
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
              Holidays and one-off closures are managed by an administrator.
            </p>
            {exceptions.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/60 px-3.5 py-4 text-xs text-ink-soft">
                No date exceptions are configured.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {exceptions.map((exception) => (
                  <li
                    key={exception.id || exception.date}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface/60 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">{formatDate(exception.date)}</p>
                      {exception.note ? (
                        <p className="truncate text-xs text-ink-soft">{exception.note}</p>
                      ) : null}
                    </div>
                    <Badge variant="muted">{exception.type || 'unavailable'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
