// Login — real backend authentication (POST /api/auth/login).
// Loading state is always cleared in `finally`, duplicate submits are blocked,
// and slow cold starts get an explanatory message instead of a frozen button.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { useDemo } from '../store/DemoContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, isLoggedIn, authLoading } = useDemo();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const inFlightRef = useRef(false);

  // Explain a long wait (cold backend) instead of leaving a silent spinner.
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Already signed in? Go straight to the right dashboard.
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    navigate(user?.role === 'ADMIN' ? '/admin' : '/customer', { replace: true });
  }, [authLoading, isLoggedIn, user, navigate]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    setError('');

    if (!EMAIL_RE.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!form.password) {
      setError('Please enter your password.');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const data = await login({ email: form.email.trim(), password: form.password });
      const role = data?.user?.role;
      const from = location.state?.from?.pathname;
      const fromMatchesRole =
        from &&
        ((role === 'ADMIN' && from.startsWith('/admin')) ||
          (role === 'CUSTOMER' && from.startsWith('/customer')));
      navigate(fromMatchesRole ? from : role === 'ADMIN' ? '/admin' : '/customer', {
        replace: true,
      });
    } catch (err) {
      const retryAfter = Number(err?.data?.retryAfterSeconds);
      if (retryAfter > 0) {
        const minutes = Math.max(1, Math.ceil(retryAfter / 60));
        setError(`Too many attempts. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      } else if (err?.code === 'TIMEOUT') {
        setError(
          'The server is taking longer than usual to start. Please wait a moment and try again — your details were kept.'
        );
      } else {
        setError(err?.message || 'Login failed. Please try again.');
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in and pick up where you left off"
      description="Manage upcoming appointments, keep your details current, and rebook your favourite services in a few taps."
      points={[
        'See every booking and its live status in one place.',
        'Cancel or review appointments without calling the studio.',
        'Your contact details are pre-filled at checkout.',
      ]}
    >
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-teal-deep uppercase">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          Account login
        </div>
        <h2 className="mt-2 text-h2">Welcome back</h2>
        <p className="mt-1 text-sm text-ink-soft">
          New to BookEase?{' '}
          <Link to="/register" className="font-semibold text-teal-deep hover:underline">
            Create an account
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="field-label">
              Email address
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                aria-invalid={Boolean(error && !EMAIL_RE.test(form.email))}
                className="field py-3 pr-3 pl-10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="field-label">
                Password
              </label>
              <span className="text-[11px] text-ink-soft">Case-sensitive</span>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                className="field py-3 pr-11 pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition hover:bg-slate-100 hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>

          {loading && slow ? (
            <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-teal-deep">
              <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              Still connecting — the server may be waking up. This can take up to 30 seconds, and
              you won&apos;t need to submit again.
            </p>
          ) : null}

          <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-deep" aria-hidden="true" />
            Secure sign-in. We never store your password in the browser.
          </p>
        </form>

        <div className="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          Having trouble signing in? Email{' '}
          <a
            href="mailto:hello@bookease.com.np"
            className="font-semibold text-teal-deep hover:underline"
          >
            hello@bookease.com.np
          </a>{' '}
          or call{' '}
          <a href="tel:+97714000000" className="font-semibold text-teal-deep hover:underline">
            +977-1-4000000
          </a>
          .
        </div>
      </div>
    </AuthShell>
  );
}
