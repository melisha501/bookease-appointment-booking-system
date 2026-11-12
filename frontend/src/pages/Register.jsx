// Register — connected to backend authentication (POST /api/auth/register).
// Creates a real customer account with a securely hashed password.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Eye, EyeOff, Sparkles, UserPlus } from 'lucide-react';

import Button from '../components/Button';
import { useDemo } from '../store/DemoContext';

function PasswordField({ id, label, value, onChange, placeholder, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label-modern">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="input-modern pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useDemo();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Please enter a valid email address.');
    if (form.phone && form.phone.replace(/\D/g, '').length < 10) return setError('Please enter a valid phone number.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');

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
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(15,118,110,0.1),transparent_24%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <div className="hidden lg:flex lg:flex-col lg:justify-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-deep shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Create your account
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink">Join BookEase</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
            Register as a customer to book services faster, keep your details ready, and access your appointment dashboard.
          </p>
          <div className="mt-8 rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Customer registration</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Your account is created securely through the backend API. Use a valid email and a password you can remember.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[1.75rem] border border-line/80 bg-white/95 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="text-center lg:text-left">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-brand to-teal-deep text-white shadow-sm lg:mx-0">
                <CalendarCheck className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">Create Account</h2>
              <p className="mt-1 text-sm text-ink-soft">Register to book and manage appointments.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label htmlFor="register-name" className="label-modern">Full Name</label>
                <input id="register-name" type="text" required placeholder="Your full name" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} className="input-modern" />
              </div>

              <div>
                <label htmlFor="register-email" className="label-modern">Email Address</label>
                <input id="register-email" type="email" required placeholder="you@example.com" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input-modern" />
              </div>

              <div>
                <label htmlFor="register-phone" className="label-modern">Phone Number</label>
                <input id="register-phone" type="tel" placeholder="98XXXXXXXX" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-modern" />
              </div>

              <PasswordField id="register-password" label="Password" placeholder="At least 6 characters" value={form.password} onChange={(e) => update('password', e.target.value)} />
              <PasswordField id="register-confirm" label="Confirm Password" placeholder="Repeat your password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />

              {error && (
                <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-soft">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-teal-deep hover:underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}