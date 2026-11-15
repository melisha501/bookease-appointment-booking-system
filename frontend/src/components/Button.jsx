// Button — the single button/link primitive used across BookEase.
// Props:
// - children, onClick, type, disabled
// - to: renders a <Link> instead of a <button>
// - variant: "primary" | "secondary" | "soft" | "ghost" | "cta" | "light" | "onDark" | "danger"
// - size: "sm" | "md" | "lg"
// - fullWidth, loading, className, ...rest

import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

const variants = {
  primary:
    'bg-teal-deep text-white shadow-[0_10px_24px_-14px_rgba(15,118,110,0.85)] hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-[0_16px_32px_-16px_rgba(15,118,110,0.85)] active:translate-y-0 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:bg-slate-300',
  secondary:
    'border border-line bg-white text-ink shadow-[0_1px_2px_rgba(11,27,43,0.03)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-soft active:translate-y-0 disabled:text-slate-400 disabled:shadow-none',
  soft:
    'bg-teal-50 text-teal-deep hover:-translate-y-0.5 hover:bg-teal-100 active:translate-y-0 disabled:bg-slate-100 disabled:text-slate-400',
  ghost:
    'text-teal-deep hover:bg-teal-50 disabled:text-slate-400',
  // High-visibility CTA for dark/teal backgrounds.
  cta:
    'border border-teal-glow/40 bg-teal-deep text-white shadow-[0_14px_34px_-16px_rgba(45,212,191,0.85)] hover:-translate-y-0.5 hover:bg-teal-800 active:translate-y-0 disabled:border-transparent disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
  light:
    'bg-white text-teal-deep shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:bg-teal-50 active:translate-y-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none',
  onDark:
    'border border-white/25 bg-white/5 text-white hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10 active:translate-y-0 disabled:border-white/15 disabled:text-white/50',
  danger:
    'border border-red-200 bg-white text-red-600 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 active:translate-y-0 disabled:border-slate-200 disabled:bg-white disabled:text-slate-400',
};

const sizes = {
  sm: 'px-3.5 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-[15px]',
};

export default function Button({
  children,
  onClick,
  to,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap ' +
    'transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ' +
    `${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${
      fullWidth ? 'w-full' : ''
    } ${isDisabled && to ? 'pointer-events-none opacity-60' : ''} ${className}`;

  if (to && !isDisabled) {
    return (
      <Link to={to} onClick={onClick} className={base} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${base} disabled:pointer-events-none`}
      {...rest}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
