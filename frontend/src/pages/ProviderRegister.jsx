// ProviderRegister — creates a PROVIDER account and provider profile.
// The provider profile starts in "pending" status until an admin approves it.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';

import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { useDemo } from '../store/DemoContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  providerName: '',
  type: 'INDIVIDUAL',
  description: '',
  address: '',
  website: '',
};

export default function ProviderRegister() {
  const navigate = useNavigate();
  const { registerProvider, user, isLoggedIn, authLoading } = useDemo();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    navigate(user?.role === 'PROVIDER' ? '/provider' : '/customer', { replace: true });
  }, [authLoading, isLoggedIn, user, navigate]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
    if (fieldError) setFieldError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    setError('');
    setFieldError('');

    if (!form.name.trim()) return setFieldError('Enter your full name.');
    if (!EMAIL_RE.test(form.email.trim())) return setFieldError('Enter a valid email address.');
    if (!form.providerName.trim()) return setFieldError('Enter your provider or organization name.');
    if (form.password.length < 6) return setFieldError('Use a password with at least 6 characters.');
    if (form.password !== form.confirm) return setFieldError('Passwords do not match.');

    inFlightRef.current = true;
    setLoading(true);
    try {
      await registerProvider({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        providerName: form.providerName.trim(),
        type: form.type,
        description: form.description.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
      });
      navigate('/provider', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not create your provider account.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Become a service provider"
      title="List your services on BookEase"
      description="Create a provider profile, add your services, and manage every booking from one dashboard."
      points={[
        'Individual practitioners and organizations are welcome.',
        'New profiles and services are reviewed by an administrator.',
        'Your approved services appear in the customer booking portal.',
      ]}
    >
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-teal-deep uppercase">
          <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
          Provider registration
        </div>
        <h2 className="mt-2 text-h2">Create a provider account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Already registered?{' '}
          <Link to="/provider/login" className="font-semibold text-teal-deep hover:underline">
            Provider login
          </Link>
          {' · '}
          <Link to="/register" className="font-semibold text-teal-deep hover:underline">
            Customer signup
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="provider-owner-name" className="field-label">
              Your full name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="provider-owner-name"
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                autoComplete="name"
                placeholder="Your full name"
                className="field py-3 pr-3 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="provider-business-name" className="field-label">
              Provider or organization name
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="provider-business-name"
                required
                value={form.providerName}
                onChange={(event) => update('providerName', event.target.value)}
                placeholder="e.g. Sunrise Dental Studio"
                className="field py-3 pr-3 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="provider-type" className="field-label">
              Provider type
            </label>
            <select
              id="provider-type"
              value={form.type}
              onChange={(event) => update('type', event.target.value)}
              className="field"
            >
              <option value="INDIVIDUAL">Individual practitioner</option>
              <option value="ORGANIZATION">Organization / business</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="provider-email" className="field-label">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="provider-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="field py-3 pr-3 pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="provider-phone" className="field-label">
                Phone <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="provider-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  autoComplete="tel"
                  placeholder="98XXXXXXXX"
                  className="field py-3 pr-3 pl-10"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="provider-address" className="field-label">
              Address <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="provider-address"
                value={form.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder="Street, city"
                className="field py-3 pr-3 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="provider-description" className="field-label">
              About your service <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id="provider-description"
              rows="3"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Tell customers what you offer and what makes your service different."
              className="field resize-y"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="provider-password" className="field-label">
                Password
              </label>
              <input
                id="provider-password"
                type="password"
                required
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="field py-3"
              />
            </div>
            <div>
              <label htmlFor="provider-confirm" className="field-label">
                Confirm password
              </label>
              <input
                id="provider-confirm"
                type="password"
                required
                value={form.confirm}
                onChange={(event) => update('confirm', event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
                className="field py-3"
              />
            </div>
          </div>

          {fieldError || error ? (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
              {fieldError || error}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Creating provider account…' : 'Create provider account'}
            {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>

          {loading && slow ? (
            <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-teal-deep">
              <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              Still connecting — the server may be waking up. Your details will be kept.
            </p>
          ) : null}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-deep" aria-hidden="true" />
            New provider profiles are reviewed by an administrator before services go live.
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
