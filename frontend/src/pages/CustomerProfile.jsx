// CustomerProfile — view and edit the logged-in customer's account information.
// Profile data comes from the authenticated backend user.

import { useEffect, useState } from 'react';
import { Check, Mail, MapPin, Pencil, Phone, User } from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import { useDemo } from '../store/DemoContext';

const inputClassName =
  'w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-teal-brand focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-soft';

function Field({ id, label, icon: Icon, ...props }) {
  const { disabled } = props;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        {Icon && <Icon className="h-4 w-4 text-teal-deep" />}
        {label}
      </label>
      <input id={id} className={inputClassName} disabled={disabled} {...props} />
    </div>
  );
}

export default function CustomerProfile() {
  const { user, refreshUser, authLoading } = useDemo();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  if (authLoading) {
    return <p className="text-sm text-ink-soft">Loading your profile…</p>;
  }

  if (!user) {
    return <p className="text-sm text-ink-soft">Please log in to view your profile.</p>;
  }

  const initials = String(user.name || 'C')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
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
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-deep text-xl font-bold text-white"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-ink">{user.name}</h3>
              <Badge>{user.role === 'ADMIN' ? 'Admin' : 'Customer'}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
            {user.phone ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                <Phone className="h-4 w-4" />
                {user.phone}
              </p>
            ) : null}
          </div>

          {!editing && (
            <Button
              variant="secondary"
              className="sm:ml-auto"
              onClick={() => {
                setEditing(true);
                setSaved(false);
                setError('');
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-ink">Profile Information</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {editing ? 'Update your details below, then press Save.' : 'Press Edit Profile to change your information.'}
        </p>

        <form onSubmit={handleSave} className="mt-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id="profile-name"
              label="Full Name"
              icon={User}
              type="text"
              required
              value={form.name}
              disabled={!editing}
              onChange={(event) => updateForm('name', event.target.value)}
            />
            <Field
              id="profile-email"
              label="Email"
              icon={Mail}
              type="email"
              value={form.email}
              disabled
              readOnly
            />
            <Field
              id="profile-phone"
              label="Phone Number"
              icon={Phone}
              type="tel"
              value={form.phone}
              disabled={!editing}
              onChange={(event) => updateForm('phone', event.target.value)}
            />
            <div>
              <label htmlFor="profile-address" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MapPin className="h-4 w-4 text-teal-deep" />
                Address
              </label>
              <input
                id="profile-address"
                type="text"
                value={form.address}
                disabled={!editing}
                onChange={(event) => updateForm('address', event.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {saved ? (
            <p className="mt-5 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-deep">
              <Check className="h-4 w-4" />
              Profile updated.
            </p>
          ) : null}

          {editing && (
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Check className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
