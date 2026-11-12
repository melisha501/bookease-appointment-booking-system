// Login — connected to backend authentication (POST /api/auth/login).
// Uses real registered accounts. JWT is stored by the app's API/auth layer.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';

import Button from '../components/Button';
import { useDemo } from '../store/DemoContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useDemo();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Please enter a valid email address.');
    if (!form.password) return setError('Please enter your password.');

    setLoading(true);
    try {
      const data = await login({ email: form.email.trim(), password: form.password });
      const role = data?.user?.role;
      const from = location.state?.from?.pathname;
      const fallback = role === 'ADMIN' ? '/admin' : '/customer';
      navigate(from || fallback, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(15,118,110,0.1),transparent_24%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div className="hidden lg:flex lg:flex-col lg:justify-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-deep shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Secure account access
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink">Welcome back to BookEase</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
            Sign in to manage appointments, view booking details, and continue where you left off.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              { icon: CalendarCheck, text: 'Track and manage your appointments from your dashboard.' },
              { icon: ShieldCheck, text: 'Authenticated access to your account and booking history.' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[1.75rem] border border-line/80 bg-white/95 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="text-center lg:text-left">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-brand to-teal-deep text-white shadow-sm lg:mx-0">
                <CalendarCheck className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">Login</h2>
              <p className="mt-1 text-sm text-ink-soft">Use your registered email and password.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label htmlFor="login-email" className="label-modern">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="input-modern"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="label-modern">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Your password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    className="input-modern pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth disabled={loading}>
                {loading ? 'Logging in…' : 'Login'}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-soft">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-teal-deep hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}