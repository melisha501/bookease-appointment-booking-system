// AdminWorkingHours — provider weekly schedule and date exceptions (backend-integrated).
// Admins can configure working days, opening/closing times, breaks, and
// mark specific dates as holidays/unavailable. Changes persist in PostgreSQL.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarOff,
  Check,
  Clock,
  Coffee,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { useDemo } from '../store/DemoContext';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMins = index * 30;
  const hour24 = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
});

function timeToMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(mins) || hour < 1 || hour > 12 || mins < 0 || mins > 59) {
    return null;
  }
  if (match[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return hour * 60 + mins;
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

const DEFAULT_SCHEDULE = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  start: '09:00 AM',
  end: '05:00 PM',
  breakStart: '',
  breakEnd: '',
};

function normalizeSchedule(schedule) {
  if (!schedule) return { ...DEFAULT_SCHEDULE };
  return {
    days: Array.isArray(schedule.days) ? schedule.days : [...DEFAULT_SCHEDULE.days],
    start: schedule.start || schedule.startTime || DEFAULT_SCHEDULE.start,
    end: schedule.end || schedule.endTime || DEFAULT_SCHEDULE.end,
    breakStart: schedule.breakStart || '',
    breakEnd: schedule.breakEnd || '',
  };
}

function validateWeeklyForm(schedule) {
  const errors = {};

  if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
    errors.days = 'Select at least one working day, or delete the schedule if this provider is unavailable.';
  }
  if (!schedule.start) errors.start = 'Opening time is required.';
  if (!schedule.end) errors.end = 'Closing time is required.';

  const startMins = timeToMinutes(schedule.start);
  const endMins = timeToMinutes(schedule.end);
  if (schedule.start && startMins == null) errors.start = 'Opening time is not valid.';
  if (schedule.end && endMins == null) errors.end = 'Closing time is not valid.';
  if (startMins != null && endMins != null && endMins <= startMins) {
    errors.end = 'Closing time must be after opening time.';
  }

  const hasBreakStart = Boolean(schedule.breakStart);
  const hasBreakEnd = Boolean(schedule.breakEnd);
  if (hasBreakStart !== hasBreakEnd) {
    errors.breakEnd = 'Set both break start and break end, or leave both as "No break".';
  }
  if (hasBreakStart && hasBreakEnd) {
    const breakStartMins = timeToMinutes(schedule.breakStart);
    const breakEndMins = timeToMinutes(schedule.breakEnd);
    if (breakStartMins == null) errors.breakStart = 'Break start time is not valid.';
    if (breakEndMins == null) errors.breakEnd = 'Break end time is not valid.';
    if (breakStartMins != null && breakEndMins != null) {
      if (breakEndMins <= breakStartMins) {
        errors.breakEnd = 'Break end time must be after break start time.';
      } else if (
        startMins != null &&
        endMins != null &&
        (breakStartMins < startMins || breakEndMins > endMins)
      ) {
        errors.breakEnd = 'Break must be within working hours.';
      }
    }
  }

  return { errors, message: Object.values(errors)[0] || '' };
}

function formatExceptionDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const EMPTY_EXCEPTION_FORM = { date: '', type: 'unavailable', note: '' };

export default function AdminWorkingHours() {
  const { specialists, refreshCatalog, catalogLoading, catalogError } = useDemo();
  const specialistList = useMemo(
    () => (Array.isArray(specialists) ? specialists : []),
    [specialists]
  );
  const [providerId, setProviderId] = useState('');
  const [schedule, setSchedule] = useState({ ...DEFAULT_SCHEDULE });
  const [dateExceptions, setDateExceptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const [exceptionForm, setExceptionForm] = useState({ ...EMPTY_EXCEPTION_FORM });
  const [editingExceptionId, setEditingExceptionId] = useState(null);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState('');
  const [exceptionFieldErrors, setExceptionFieldErrors] = useState({});
  const [scheduleDeleteOpen, setScheduleDeleteOpen] = useState(false);
  const [exceptionDeleteTarget, setExceptionDeleteTarget] = useState(null);
  const [exceptionDeleting, setExceptionDeleting] = useState(false);

  const provider = useMemo(
    () => specialistList.find((s) => s.id === providerId) || null,
    [specialistList, providerId]
  );

  // Include any non-standard time values already stored so edits never silently drop them.
  const timeOptions = useMemo(() => {
    const values = new Set(TIME_OPTIONS);
    for (const key of ['start', 'end', 'breakStart', 'breakEnd']) {
      if (schedule[key]) values.add(schedule[key]);
    }
    return Array.from(values).sort((a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0));
  }, [schedule]);

  useEffect(() => {
    if (!providerId && specialistList.length > 0) {
      setProviderId(specialistList[0].id);
    }
  }, [specialistList, providerId]);

  const flash = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const loadWorkingHours = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/specialists/${encodeURIComponent(id)}/working-hours`);
      setSchedule(normalizeSchedule(data?.schedule));
      setDateExceptions(Array.isArray(data?.dateExceptions) ? data.dateExceptions : []);
    } catch (err) {
      if (err?.status === 404) {
        setSchedule({ ...DEFAULT_SCHEDULE });
        setDateExceptions([]);
      } else {
        setError(err?.message || 'Failed to load working hours.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    try {
      const data = await api.get('/appointments');
      setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch {
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (providerId) {
      setExceptionForm({ ...EMPTY_EXCEPTION_FORM });
      setEditingExceptionId(null);
      setExceptionFieldErrors({});
      setExceptionError('');
      loadWorkingHours(providerId);
    }
  }, [providerId, loadWorkingHours]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const assigned = useMemo(() => {
    if (!provider) return [];
    return (Array.isArray(appointments) ? appointments : []).filter((a) => {
      const sp = a.specialistId || a.specialist;
      return (
        sp === provider.id ||
        sp === provider.slug ||
        sp === provider.dbId ||
        a.specialist === provider.name
      );
    });
  }, [appointments, provider]);

  const updateSchedule = (field, value) => {
    setSchedule((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const toggleDay = (day) => {
    setSchedule((prev) => {
      const has = prev.days.includes(day);
      const days = has ? prev.days.filter((d) => d !== day) : [...prev.days, day];
      const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return { ...prev, days };
    });
    setFieldErrors((prev) => ({ ...prev, days: '' }));
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!providerId) return;
    const { errors, message } = validateWeeklyForm(schedule);
    setFieldErrors(errors);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        days: schedule.days,
        start: schedule.start,
        end: schedule.end,
        breakStart: schedule.breakStart || null,
        breakEnd: schedule.breakEnd || null,
      };
      const data = await api.put(`/specialists/${encodeURIComponent(providerId)}/working-hours`, payload);
      setSchedule(normalizeSchedule(data?.schedule));
      setFieldErrors({});
      flash('Working hours saved to the database.');
      await refreshCatalog().catch(() => {});
    } catch (err) {
      setError(err?.message || 'Failed to save working hours.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!providerId) return;
    setSaving(true);
    setError('');
    try {
      await api.del(`/specialists/${encodeURIComponent(providerId)}/working-hours`);
      setSchedule({ ...DEFAULT_SCHEDULE });
      setScheduleDeleteOpen(false);
      flash('Weekly schedule deleted.');
      await refreshCatalog().catch(() => {});
    } catch (err) {
      setScheduleDeleteOpen(false);
      setError(err?.message || 'Failed to delete working hours.');
    } finally {
      setSaving(false);
    }
  };

  const resetExceptionForm = () => {
    setExceptionForm({ ...EMPTY_EXCEPTION_FORM });
    setEditingExceptionId(null);
    setExceptionFieldErrors({});
    setExceptionError('');
  };

  const handleExceptionSubmit = async (e) => {
    e.preventDefault();
    if (!providerId) return;

    const date = String(exceptionForm.date || '').trim();
    if (!date) {
      setExceptionFieldErrors({ date: 'Please select a date.' });
      setExceptionError('Please select a date.');
      return;
    }
    if (!isValidDateInput(date)) {
      setExceptionFieldErrors({ date: 'Enter a valid calendar date (YYYY-MM-DD).' });
      setExceptionError('Enter a valid calendar date (YYYY-MM-DD).');
      return;
    }

    setExceptionFieldErrors({});
    setExceptionSaving(true);
    setExceptionError('');
    try {
      const payload = {
        date,
        type: exceptionForm.type,
        note: exceptionForm.note?.trim() || '',
      };
      if (editingExceptionId) {
        await api.patch(
          `/specialists/${encodeURIComponent(providerId)}/date-exceptions/${encodeURIComponent(editingExceptionId)}`,
          payload
        );
        flash('Date exception updated.');
      } else {
        await api.post(`/specialists/${encodeURIComponent(providerId)}/date-exceptions`, payload);
        flash('Date exception saved.');
      }
      resetExceptionForm();
      await loadWorkingHours(providerId);
    } catch (err) {
      setExceptionError(err?.message || 'Failed to save date exception.');
    } finally {
      setExceptionSaving(false);
    }
  };

  const handleEditException = (ex) => {
    setEditingExceptionId(ex.id || ex.date);
    setExceptionForm({
      date: ex.date || '',
      type: ex.type === 'holiday' ? 'holiday' : 'unavailable',
      note: ex.note || '',
    });
    setExceptionFieldErrors({});
    setExceptionError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelExceptionEdit = () => {
    resetExceptionForm();
  };

  const handleDeleteException = async (ex) => {
    if (!providerId || !ex || exceptionDeleting) return;
    setExceptionDeleting(true);
    setExceptionError('');
    try {
      await api.del(
        `/specialists/${encodeURIComponent(providerId)}/date-exceptions/${encodeURIComponent(ex.id || ex.date)}`
      );
      if (editingExceptionId && (editingExceptionId === ex.id || editingExceptionId === ex.date)) {
        resetExceptionForm();
      }
      setExceptionDeleteTarget(null);
      flash('Date exception removed.');
      await loadWorkingHours(providerId);
    } catch (err) {
      setExceptionDeleteTarget(null);
      setExceptionError(err?.message || 'Failed to remove date exception.');
    } finally {
      setExceptionDeleting(false);
    }
  };

  const handleComplete = async (ref) => {
    try {
      await api.patch(`/appointments/${encodeURIComponent(ref)}/status`, { status: 'completed' });
      flash('Appointment marked as completed.');
      await loadAppointments();
    } catch (err) {
      setError(err?.message || 'Failed to update appointment.');
    }
  };

  if (catalogLoading && specialistList.length === 0) {
    return (
      <div className="space-y-6" aria-label="Loading specialists">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-8 w-56" />
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="skeleton h-96 rounded-2xl lg:col-span-3" />
          <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (catalogError && specialistList.length === 0) {
    return (
      <Card>
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {catalogError}
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => refreshCatalog()}>
          Retry
        </Button>
      </Card>
    );
  }

  if (specialistList.length === 0) {
    return (
      <EmptyState
        title="No specialists yet"
        description="Add a specialist first, then configure their weekly schedule and unavailable dates."
        icon={Clock}
      >
        <Button to="/admin/providers">Manage providers</Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
          Availability
        </p>
        <h2 className="mt-2 text-h2">Working hours</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Set weekly opening hours, breaks, and date exceptions per provider. Booking availability
          reads directly from this schedule.
        </p>
      </div>

      {catalogError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          <span>{catalogError}</span>
          <Button variant="secondary" size="sm" onClick={() => refreshCatalog()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Clock className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                  Weekly schedule
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Choose the provider, then adjust their standard week.
                </p>
              </div>
              {provider ? (
                <Badge variant={loading ? 'muted' : 'default'}>
                  {provider.name} · {provider.title}
                </Badge>
              ) : null}
            </div>

            <div className="mt-5 max-w-md">
              <label htmlFor="provider-select" className="field-label">
                Specialist
              </label>
              <select
                id="provider-select"
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value);
                  setError('');
                  setNotice('');
                }}
                className="field"
              >
                {specialistList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.title}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-deep"
              >
                {notice}
              </p>
            )}

            {loading ? (
              <div className="mt-6 space-y-4" aria-label="Loading working hours">
                <div className="skeleton h-10 w-full rounded-xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="skeleton h-11 rounded-xl" />
                  ))}
                </div>
                <div className="skeleton h-24 rounded-xl" />
              </div>
            ) : (
              <form onSubmit={handleSaveSchedule} className="mt-6 space-y-6">
                <div>
                  <p className="text-sm font-semibold text-ink">Working days</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_DAYS.map((day) => {
                      const active = schedule.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          aria-pressed={active}
                          title={DAY_LABELS[day]}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? 'bg-teal-deep text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,0.8)]'
                              : 'border border-line bg-white text-ink-soft hover:border-slate-300 hover:bg-slate-50 hover:text-ink'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Unchecked days are non-working days. Specific dates can be marked unavailable
                    or as holidays below.
                  </p>
                  {fieldErrors.days && (
                    <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.days}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="wh-start" className="field-label">
                      Opening time
                    </label>
                    <select
                      id="wh-start"
                      value={schedule.start}
                      onChange={(e) => updateSchedule('start', e.target.value)}
                      aria-invalid={Boolean(fieldErrors.start)}
                      aria-describedby={fieldErrors.start ? 'wh-start-error' : undefined}
                      className="field"
                    >
                      {timeOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.start && (
                      <p id="wh-start-error" className="field-error">
                        {fieldErrors.start}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="wh-end" className="field-label">
                      Closing time
                    </label>
                    <select
                      id="wh-end"
                      value={schedule.end}
                      onChange={(e) => updateSchedule('end', e.target.value)}
                      aria-invalid={Boolean(fieldErrors.end)}
                      aria-describedby={fieldErrors.end ? 'wh-end-error' : undefined}
                      className="field"
                    >
                      {timeOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.end && (
                      <p id="wh-end-error" className="field-error">
                        {fieldErrors.end}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="wh-break-start" className="field-label">
                      Break start
                    </label>
                    <select
                      id="wh-break-start"
                      value={schedule.breakStart}
                      onChange={(e) => updateSchedule('breakStart', e.target.value)}
                      aria-invalid={Boolean(fieldErrors.breakStart)}
                      aria-describedby={fieldErrors.breakStart ? 'wh-break-start-error' : undefined}
                      className="field"
                    >
                      <option value="">No break</option>
                      {timeOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.breakStart && (
                      <p id="wh-break-start-error" className="field-error">
                        {fieldErrors.breakStart}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="wh-break-end" className="field-label">
                      Break end
                    </label>
                    <select
                      id="wh-break-end"
                      value={schedule.breakEnd}
                      onChange={(e) => updateSchedule('breakEnd', e.target.value)}
                      aria-invalid={Boolean(fieldErrors.breakEnd)}
                      aria-describedby={fieldErrors.breakEnd ? 'wh-break-end-error' : undefined}
                      className="field"
                    >
                      <option value="">No break</option>
                      {timeOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.breakEnd && (
                      <p id="wh-break-end-error" className="field-error">
                        {fieldErrors.breakEnd}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-teal-100/80 bg-teal-50/60 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-teal-deep">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Schedule summary
                  </p>
                  <div className="mt-2 grid gap-1.5 text-xs leading-relaxed text-ink-soft">
                    <p>
                      <span className="font-semibold text-ink">Working:</span>{' '}
                      {schedule.days.length ? schedule.days.join(', ') : 'None'}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">Hours:</span> {schedule.start} –{' '}
                      {schedule.end}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Coffee className="h-3.5 w-3.5 text-teal-deep" aria-hidden="true" />
                      {schedule.breakStart && schedule.breakEnd
                        ? `Break ${schedule.breakStart} – ${schedule.breakEnd}`
                        : 'No break configured'}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                    Slots outside these hours, during breaks, or on unavailable dates are blocked
                    in booking.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                  <Button type="submit" loading={saving} disabled={saving}>
                    {saving ? 'Saving…' : 'Save schedule'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setScheduleDeleteOpen(true)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete weekly schedule
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <CalendarOff className="h-5 w-5 text-teal-deep" aria-hidden="true" />
              Unavailable dates &amp; holidays
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Block specific calendar dates. Bookings are prevented on these dates.
            </p>

            {exceptionError && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {exceptionError}
              </p>
            )}

            <form
              onSubmit={handleExceptionSubmit}
              className="mt-4 grid gap-3 rounded-xl border border-line bg-surface/70 p-4 sm:grid-cols-2"
            >
              <div>
                <label htmlFor="ex-date" className="field-label">
                  Date
                </label>
                <input
                  id="ex-date"
                  type="date"
                  value={exceptionForm.date}
                  onChange={(e) => {
                    setExceptionForm((f) => ({ ...f, date: e.target.value }));
                    setExceptionFieldErrors((prev) => ({ ...prev, date: '' }));
                  }}
                  aria-invalid={Boolean(exceptionFieldErrors.date)}
                  aria-describedby={exceptionFieldErrors.date ? 'ex-date-error' : undefined}
                  className="field"
                />
                {exceptionFieldErrors.date && (
                  <p id="ex-date-error" className="field-error">
                    {exceptionFieldErrors.date}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="ex-type" className="field-label">
                  Type
                </label>
                <select
                  id="ex-type"
                  value={exceptionForm.type}
                  onChange={(e) => setExceptionForm((f) => ({ ...f, type: e.target.value }))}
                  className="field"
                >
                  <option value="unavailable">Unavailable</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ex-note" className="field-label">
                  Note <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <input
                  id="ex-note"
                  type="text"
                  maxLength={200}
                  value={exceptionForm.note}
                  onChange={(e) => setExceptionForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Public holiday, personal leave"
                  className="field"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <Button
                  type="submit"
                  loading={exceptionSaving}
                  disabled={exceptionSaving || !exceptionForm.date}
                >
                  {exceptionSaving
                    ? 'Saving…'
                    : editingExceptionId
                      ? 'Update date exception'
                      : 'Add date exception'}
                </Button>
                {editingExceptionId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelExceptionEdit}
                    disabled={exceptionSaving}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
              {editingExceptionId && (
                <p className="text-xs font-semibold text-teal-deep sm:col-span-2">
                  Editing an existing date exception.
                </p>
              )}
            </form>

            <div className="mt-4 space-y-2">
              {dateExceptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-ink">No exceptions configured</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Add holidays or unavailable dates above when needed.
                  </p>
                </div>
              ) : (
                dateExceptions.map((ex) => (
                  <div
                    key={ex.id || ex.date}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink">
                          {formatExceptionDate(ex.date)}
                        </p>
                        <Badge variant={ex.type === 'holiday' ? 'warning' : 'muted'}>
                          {ex.type === 'holiday' ? 'Holiday' : 'Unavailable'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-soft">{ex.date}</p>
                      {ex.note ? (
                        <p className="mt-1 text-xs break-words text-ink-soft">{ex.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditException(ex)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-slate-300 hover:bg-slate-50"
                        aria-label={`Edit exception for ${ex.date}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setExceptionDeleteTarget(ex)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                        aria-label={`Remove exception for ${ex.date}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="h-fit lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">Assigned appointments</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                {provider ? provider.name : 'Provider'} · {assigned.length} booking
                {assigned.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadAppointments()}
              disabled={appointmentsLoading}
              aria-label="Refresh assigned appointments"
              className="rounded-lg border border-line p-2 text-ink-soft transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${appointmentsLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {appointmentsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="skeleton h-20 rounded-xl" />
                ))}
              </div>
            ) : assigned.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center">
                <Clock className="mx-auto h-6 w-6 text-teal-deep/60" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">No assigned appointments</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Bookings for this provider will appear here.
                </p>
              </div>
            ) : (
              assigned.map((a) => {
                const ref = a.reference || a.id;
                return (
                  <div key={ref} className="rounded-xl border border-line bg-white p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{a.service}</p>
                        <p className="mt-0.5 text-xs break-words text-ink-soft">
                          {a.customer || a.customerName} · {a.date} {a.time}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{ref}</p>
                      </div>
                      <span className="shrink-0">
                        <StatusBadge status={a.status} />
                      </span>
                    </div>
                    {a.status === 'confirmed' && (
                      <Button size="sm" className="mt-3" onClick={() => handleComplete(ref)}>
                        <Check className="h-4 w-4" aria-hidden="true" /> Mark completed
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={scheduleDeleteOpen}
        onClose={() => setScheduleDeleteOpen(false)}
        onConfirm={handleDeleteSchedule}
        title="Delete weekly schedule"
        description="Delete the weekly working schedule for this provider? Existing date exceptions will remain until removed."
        confirmLabel="Delete schedule"
        loading={saving}
      />

      <ConfirmDialog
        open={Boolean(exceptionDeleteTarget)}
        onClose={() => setExceptionDeleteTarget(null)}
        onConfirm={async () => {
          await handleDeleteException(exceptionDeleteTarget);
        }}
        title="Remove date exception"
        description={`Remove the unavailable/holiday entry for ${exceptionDeleteTarget?.date || ''}?`}
        confirmLabel="Remove exception"
        loading={exceptionDeleting}
      />
    </div>
  );
}
