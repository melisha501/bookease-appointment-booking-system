// ProviderProfile — public identity, contact information, and logo for a provider.
// The public profile and its services are reviewed before appearing to customers.

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  Save,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ImageUploadField from '../components/ImageUploadField';
import { useDemo } from '../store/DemoContext';

const EMPTY_FORM = {
  name: '',
  type: 'INDIVIDUAL',
  description: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  ownerName: '',
};

export default function ProviderProfile() {
  const { refreshUser } = useDemo();
  const [provider, setProvider] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [noProfile, setNoProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoProgress, setLogoProgress] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNoProfile(false);
    try {
      const data = await api.get('/providers/me');
      const next = data?.provider || null;
      setProvider(next);
      if (next) {
        setForm({
          name: next.name || '',
          type: next.type || 'INDIVIDUAL',
          description: next.description || '',
          email: next.email || next.ownerEmail || '',
          phone: next.phone || next.ownerPhone || '',
          address: next.address || '',
          website: next.website || '',
          ownerName: next.ownerName || '',
        });
      }
    } catch (err) {
      if (err?.data?.code === 'NO_PROVIDER_PROFILE' || err?.status === 404) {
        setNoProfile(true);
      } else {
        setLoadError(err?.message || 'Could not load your provider profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (status.message) setStatus({ type: '', message: '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Provider name is required.' });
      return;
    }
    setSaving(true);
    setStatus({ type: 'loading', message: 'Saving provider profile…' });
    try {
      const data = await api.patch('/providers/me', {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        ownerName: form.ownerName.trim(),
      });
      if (data?.provider) {
        setProvider(data.provider);
        setForm((current) => ({
          ...current,
          name: data.provider.name || current.name,
          ownerName: data.provider.ownerName || current.ownerName,
        }));
      }
      if (typeof refreshUser === 'function') refreshUser().catch(() => {});
      setStatus({ type: 'success', message: data?.message || 'Provider profile updated.' });
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not save your provider profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      setStatus({ type: 'error', message: 'Choose a logo image first.' });
      return;
    }
    setLogoProgress(0);
    setStatus({ type: 'loading', message: 'Uploading provider logo…' });
    try {
      const fd = new FormData();
      fd.append('image', logoFile);
      const data = await api.postFormWithProgress('/providers/me/logo', fd, setLogoProgress);
      if (data?.provider) setProvider(data.provider);
      setLogoFile(null);
      setLogoProgress(0);
      setStatus({
        type: data?.warning ? 'warning' : 'success',
        message: data?.warning || data?.message || 'Provider logo updated.',
      });
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not upload the logo.' });
    }
  };

  const handleRemoveLogo = async () => {
    setStatus({ type: 'loading', message: 'Removing logo…' });
    try {
      const data = await api.del('/providers/me/logo');
      if (data?.provider) setProvider(data.provider);
      setLogoFile(null);
      setStatus({
        type: data?.warning ? 'warning' : 'success',
        message: data?.warning || data?.message || 'Provider logo removed.',
      });
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not remove the logo.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
          <div className="skeleton h-[32rem] rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (noProfile) {
    return (
      <EmptyState
        title="No provider profile yet"
        description="Create a provider profile to manage your public identity."
        icon={UserRound}
      >
        <Button to="/provider/register">Create a provider profile</Button>
      </EmptyState>
    );
  }

  if (loadError) {
    return (
      <EmptyState title="Could not load your profile" description={loadError} icon={UserRound}>
        <Button onClick={load}>Try again</Button>
      </EmptyState>
    );
  }

  const statusVariant =
    provider?.status === 'approved' ? 'success' : provider?.status === 'rejected' ? 'danger' : 'warning';

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
          Provider identity
        </p>
        <h2 className="mt-2 text-h2">Provider profile</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Customers see this identity on your service pages, provider profile, and booking
          confirmations. Keep contact details and your description accurate.
        </p>
      </div>

      <div className="rounded-2xl border border-line/80 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {provider?.logo ? (
              <img
                src={provider.logo}
                alt=""
                className="h-14 w-14 rounded-2xl border border-line object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-ink">{provider?.name}</h3>
                <Badge variant={statusVariant}>Profile {provider?.status || 'pending'}</Badge>
                {!provider?.isActive ? <Badge variant="muted">Inactive</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                {provider?.type === 'ORGANIZATION' ? 'Organization' : 'Individual practitioner'}
                {provider?.slug ? ` · /providers/${provider.slug}` : ''}
              </p>
            </div>
          </div>
          {provider?.status === 'approved' && provider?.isActive ? (
            <Button to={`/providers/${provider.id}`} variant="secondary" size="sm">
              View public page
            </Button>
          ) : null}
        </div>
        {status.message ? (
          <p
            role="status"
            className={`mt-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
              status.type === 'error'
                ? 'border border-red-100 bg-red-50 text-red-700'
                : status.type === 'warning'
                  ? 'border border-amber-100 bg-amber-50 text-amber-800'
                  : 'border border-teal-100 bg-teal-50 text-teal-deep'
            }`}
          >
            {status.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <Card>
          <h3 className="text-base font-bold text-ink">Public details</h3>
          <p className="mt-1 text-xs text-ink-soft">
            These details are shown to customers once your profile and services are approved.
          </p>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="provider-profile-name" className="field-label">
                Provider or organization name
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="provider-profile-name"
                  required
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="e.g. Sunrise Dental Studio"
                  className="field py-2.5 pr-3 pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="provider-profile-type" className="field-label">
                Provider type
              </label>
              <select
                id="provider-profile-type"
                value={form.type}
                onChange={(event) => update('type', event.target.value)}
                className="field"
              >
                <option value="INDIVIDUAL">Individual practitioner</option>
                <option value="ORGANIZATION">Organization / business</option>
              </select>
            </div>

            <div>
              <label htmlFor="provider-profile-description" className="field-label">
                About your service
              </label>
              <textarea
                id="provider-profile-description"
                rows="4"
                maxLength={1200}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Tell customers about your team, experience, and what makes your service different."
                className="field resize-y"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="provider-profile-email" className="field-label">
                  Contact email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="provider-profile-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    placeholder="hello@example.com"
                    className="field py-2.5 pr-3 pl-10"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="provider-profile-phone" className="field-label">
                  Contact phone
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="provider-profile-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    placeholder="98XXXXXXXX"
                    className="field py-2.5 pr-3 pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="provider-profile-address" className="field-label">
                Address
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="provider-profile-address"
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  placeholder="Street, city"
                  className="field py-2.5 pr-3 pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="provider-profile-website" className="field-label">
                Website <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="provider-profile-website"
                  type="url"
                  value={form.website}
                  onChange={(event) => update('website', event.target.value)}
                  placeholder="https://example.com"
                  className="field py-2.5 pr-3 pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="provider-profile-owner" className="field-label">
                Account holder name
              </label>
              <input
                id="provider-profile-owner"
                value={form.ownerName}
                onChange={(event) => update('ownerName', event.target.value)}
                placeholder="Your full name"
                className="field"
              />
              <p className="mt-1 text-xs text-ink-soft">Used for your login account, not shown publicly.</p>
            </div>

            <Button type="submit" loading={saving} disabled={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <ImageUploadField
            id="provider-logo"
            label="Provider logo"
            description="Shown on your public provider page and beside your services."
            file={logoFile}
            onFileChange={setLogoFile}
            currentImageUrl={provider?.logo || ''}
            onUpload={handleUploadLogo}
            onRemove={handleRemoveLogo}
            canUpload
            busy={saving}
            progress={logoProgress}
            status={status}
            uploadLabel="Upload logo"
            removeLabel="Remove logo"
            removeConfirm="Remove your provider logo? The profile will be kept."
            shape="avatar"
            emptyText="No logo uploaded yet."
            helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB. A square logo works best."
          />

          <Card>
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <BadgeCheck className="h-5 w-5 text-teal-deep" aria-hidden="true" />
              Review & visibility
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-soft">
              <li className="rounded-xl border border-line/80 bg-surface/60 px-3.5 py-2.5">
                Profile changes keep your current review status. Administrators can approve, reject,
                or deactivate provider accounts.
              </li>
              <li className="rounded-xl border border-line/80 bg-surface/60 px-3.5 py-2.5">
                Customers only see approved providers with at least one approved and published
                service.
              </li>
              <li className="rounded-xl border border-line/80 bg-surface/60 px-3.5 py-2.5">
                Your logo is stored on UploadThing and only the image URL is saved in PostgreSQL.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
