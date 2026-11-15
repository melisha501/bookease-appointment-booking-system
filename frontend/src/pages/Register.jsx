// Register — creates a real customer account via POST /api/auth/register.
// Duplicate submits are blocked and loading always resolves, even on timeout.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  UserPlus,
} from 'lucide-react';

import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { useDemo } from '../store/DemoContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function passwordScore(value) {
  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH = [
  { label: 'Too short', color: 'bg-slate-200' },
  { label: 'Weak', color: 'bg-red-400' },
  { label: 'Fair', color: 'bg-amber-400' },
  { label: 'Good', color: 'bg-teal-brand' },
  { label: 'Strong', color: 'bg-teal-deep' },
];

function PasswordField({ id, label, value, onChange, placeholder, error, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className={`field py-3 pr-11 pl-10 ${error ? 'border-red-300' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition hover:bg-slate-100 hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { register, user, isLoggedIn, authLoading } = useDemo();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
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
    navigate(user?.role === 'ADMIN' ? '/admin' : '/customer', { replace: true });
  }, [authLoading, isLoggedIn, user, navigate]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    if (error) setError('');
  };

  const score = passwordScore(form.password);
  const strength = STRENGTH[score];

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 10) {
      next.phone = 'Enter at least 10 digits, or leave this blank.';
    }
    if (form.password.length < 6) next.password = 'Use at least 6 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    setError('');

    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please fix the highlighted fields.');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      navigate('/customer', { replace: true });
    } catch (err) {
      const retryAfter = Number(err?.data?.retryAfterSeconds);
      if (retryAfter > 0) {
        const minutes = Math.max(1, Math.ceil(retryAfter / 60));
        setError(`Too many attempts. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      } else if (err?.code === 'TIMEOUT') {
        setError(
          'The server is taking longer than usual to start. Please try again in a moment — your details were kept.'
        );
      } else {
        setError(err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create your account"
      title="A faster way to book and manage appointments"
      description="One account keeps your details ready, tracks every booking, and makes rebooking effortless."
      points={[
        'Book in seconds with saved contact details.',
        'See pending, confirmed and completed appointments.',
        'No payment details are stored — ever.',
      ]}
    >
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-teal-deep uppercase">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Customer registration
        </div>
        <h2 className="mt-2 text-h2">Create your account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-teal-deep hover:underline">
            Sign in
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <div>
            <label htmlFor="register-name" className="field-label">
              Full name
            </label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="register-name"
                type="text"
                required
                autoFocus
                placeholder="Your full name"
                autoComplete="name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                className={`field py-3 pr-3 pl-10 ${fieldErrors.name ? 'border-red-300' : ''}`}
              />
            </div>
            {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="register-email" className="field-label">
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="register-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`field py-3 pr-3 pl-10 ${fieldErrors.email ? 'border-red-300' : ''}`}
                />
              </div>
              {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label htmlFor="register-phone" className="field-label">
                Phone <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="register-phone"
                  type="tel"
                  placeholder="98XXXXXXXX"
                  autoComplete="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`field py-3 pr-3 pl-10 ${fieldErrors.phone ? 'border-red-300' : ''}`}
                />
              </div>
              {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
            </div>
          </div>

          <PasswordField
            id="register-password"
            label="Password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            error={fieldErrors.password}
          />

          {form.password ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        index < score ? strength.color : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-ink-soft">
                  {strength.label}
                </span>
              </div>
              <p className="field-hint">
                Longer passwords with numbers and symbols are harder to guess.
              </p>
            </div>
          ) : null}

          <PasswordField
            id="register-confirm"
            label="Confirm password"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={(event) => update('confirm', event.target.value)}
            error={fieldErrors.confirm}
          />

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
            {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>

          {loading && slow ? (
            <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-teal-deep">
              <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              Still connecting — the server may be waking up. This can take up to 30 seconds, and
              you won&apos;t need to submit again.
            </p>
          ) : null}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-deep" aria-hidden="true" />
            Your password is hashed on the server and never stored in the browser.
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
