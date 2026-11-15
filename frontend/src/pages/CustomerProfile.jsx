// CustomerProfile — view and edit the logged-in customer's account information.
// Profile data comes from the authenticated backend user.

import { useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import { useDemo } from '../store/DemoContext';

function formatMemberSince(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function isPhoneValid(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  return /^\+?[\d\s().-]{7,20}$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7;
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading profile">
      <div className="surface-card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="skeleton h-20 w-20 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3.5 w-64" />
            <div className="skeleton h-3.5 w-40" />
          </div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="surface-card space-y-4 p-6">
          <div className="skeleton h-4 w-40" />
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="surface-card space-y-4 p-6">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="skeleton h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerProfile() {
  const { user, refreshUser, authLoading } = useDemo();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [syncedUser, setSyncedUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Keep the form in sync when the authenticated user resolves or refreshes.
  // Render-time adjustment replaces an effect and avoids an extra render pass.
  if (user && user !== syncedUser) {
    setSyncedUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
    });
  }

  if (authLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <Card className="text-center">
        <span className="icon-tile mx-auto">
          <User className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-bold text-ink">You are not signed in</h3>
        <p className="mt-1 text-sm text-ink-soft">Log in to view and update your profile details.</p>
        <Button to="/login" className="mt-5">
          Go to login
        </Button>
      </Card>
    );
  }

  const initials = String(user.name || 'C')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const completionFields = [
    { label: 'name', value: user.name },
    { label: 'email', value: user.email },
    { label: 'phone', value: user.phone },
    { label: 'address', value: user.address },
  ];
  const completion = Math.round(
    (completionFields.filter((field) => String(field.value || '').trim()).length /
      completionFields.length) *
      100
  );
  const missingFields = completionFields
    .filter((field) => !String(field.value || '').trim())
    .map((field) => field.label);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setError('');
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');

    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Please enter your full name.';
    if (!isPhoneValid(form.phone)) {
      nextErrors.phone = 'Enter a valid phone number (at least 7 digits).';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await api.put('/auth/profile', {
        name: form.name,
        phone: form.phone,
        address: form.address,
      });
      await refreshUser();
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
    });
    setEditing(false);
    setSaved(false);
    setError('');
    setFieldErrors({});
  };

  const startEditing = () => {
    setEditing(true);
    setSaved(false);
    setError('');
    setFieldErrors({});
  };

  return (
    <div className="space-y-6">
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
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-deep text-2xl font-bold text-white shadow-lift ring-4 ring-white"
          >
            {initials}
            <span className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                {user.name}
              </h2>
              <Badge variant={user.role === 'ADMIN' ? 'warning' : 'default'}>
                {user.role === 'ADMIN' ? 'Admin' : 'Customer'}
              </Badge>
              <Badge variant="success" dot>
                Active account
              </Badge>
            </div>
            <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-soft">
              <Mail className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
              <span className="truncate">{user.email}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                {user.phone || 'No phone added'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                Member since {formatMemberSince(user.createdAt)}
              </span>
            </div>
          </div>

          {!editing ? (
            <Button variant="secondary" className="self-start sm:self-center" onClick={startEditing}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </Button>
          ) : (
            <Button variant="ghost" className="self-start sm:self-center" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4" aria-hidden="true" />
              Stop editing
            </Button>
          )}
        </div>

        {/* Completion meter */}
        <div className="relative mt-5 rounded-xl border border-line/80 bg-surface/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <BadgeCheck className="h-4 w-4 text-teal-deep" aria-hidden="true" />
              Profile completion
            </p>
            <span className="text-xs font-bold text-teal-deep">{completion}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-line"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-deep to-teal-glow transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            {missingFields.length === 0
              ? 'Your profile is complete. We have everything needed to reach you about appointments.'
              : `Add your ${missingFields.join(', ')} to complete your profile.`}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Editable details */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">Personal information</h3>
              <p className="mt-1 text-sm text-ink-soft">
                {editing
                  ? 'Update your details below, then save your changes.'
                  : 'These details are used on your bookings and appointment reminders.'}
              </p>
            </div>
            {editing ? <Badge variant="warning">Editing</Badge> : null}
          </div>

          <form onSubmit={handleSave} className="mt-6" noValidate>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="field-label">
                  <User className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                  Full name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  disabled={!editing}
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className="field"
                />
                {fieldErrors.name ? (
                  <p role="alert" className="field-error">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="profile-email" className="field-label">
                  <Mail className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                  Email address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  readOnly
                  disabled
                  className="field"
                />
                <p className="field-hint">Your email is used to sign in and cannot be changed here.</p>
              </div>

              <div>
                <label htmlFor="profile-phone" className="field-label">
                  <Phone className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                  Phone number
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +1 555 010 2030"
                  value={form.phone}
                  disabled={!editing}
                  aria-invalid={Boolean(fieldErrors.phone) || undefined}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  className="field"
                />
                {fieldErrors.phone ? (
                  <p role="alert" className="field-error">
                    {fieldErrors.phone}
                  </p>
                ) : (
                  <p className="field-hint">Used only for appointment updates.</p>
                )}
              </div>

              <div>
                <label htmlFor="profile-address" className="field-label">
                  <MapPin className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                  Address
                </label>
                <input
                  id="profile-address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Street, city, postal code"
                  value={form.address}
                  disabled={!editing}
                  onChange={(event) => updateForm('address', event.target.value)}
                  className="field"
                />
                <p className="field-hint">Optional — helps providers plan on-site services.</p>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            {saved ? (
              <p
                role="status"
                className="mt-5 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Profile updated successfully.
              </p>
            ) : null}

            {editing ? (
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-soft">Need to change something? Start editing above.</p>
                <Button variant="soft" size="sm" onClick={startEditing}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit details
                </Button>
              </div>
            )}
          </form>
        </Card>

        {/* Account summary */}
        <aside className="space-y-4">
          <Card>
            <h3 className="text-base font-bold text-ink">Account</h3>
            <p className="mt-1 text-sm text-ink-soft">Your sign-in and membership details.</p>
            <dl className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-surface/70 px-3.5 py-3">
                <span className="icon-tile h-9 w-9 rounded-lg">
                  <IdCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Account type</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {user.role === 'ADMIN' ? 'Administrator' : 'Customer'}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-surface/70 px-3.5 py-3">
                <span className="icon-tile h-9 w-9 rounded-lg">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Member since</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{formatMemberSince(user.createdAt)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-surface/70 px-3.5 py-3">
                <span className="icon-tile h-9 w-9 rounded-lg">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Sign-in email</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{user.email}</dd>
                </div>
              </div>
            </dl>
          </Card>

          <div className="rounded-2xl border border-teal-100/80 bg-teal-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-teal-deep">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Your details stay private
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              Contact information is only shared with the specialist attached to your confirmed
              appointments, and never shown publicly on the site.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
