// Button — shared button/link component used across the site.
// Props:
// - children, onClick, type, disabled
// - to: if provided, renders a <Link> (for navigation) instead of a <button>
// - variant: "primary" | "secondary" | "ghost" | "soft"
// - size: "sm" | "md" | "lg"
// - fullWidth: true for full-width buttons (e.g. forms)

import { Link } from 'react-router-dom';

const variants = {
  primary:
    'bg-teal-deep text-white shadow-[0_8px_20px_-10px_rgba(15,118,110,0.65)] hover:-translate-y-0.5 hover:bg-teal-brand hover:shadow-[0_14px_28px_-14px_rgba(20,184,166,0.7)] active:translate-y-0 disabled:translate-y-0 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:bg-slate-300',
  secondary:
    'border border-line bg-white/95 text-ink shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm active:translate-y-0 disabled:translate-y-0 disabled:text-slate-400 disabled:shadow-none',
  soft:
    'bg-teal-50 text-teal-deep hover:-translate-y-0.5 hover:bg-teal-100 active:translate-y-0 disabled:translate-y-0 disabled:bg-slate-100 disabled:text-slate-400',
  ghost:
    'text-teal-deep hover:bg-teal-50 disabled:text-slate-400',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
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
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
    'transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ' +
    `${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} ${
      disabled && to ? 'pointer-events-none opacity-60' : ''
    } ${className}`;

  if (to) {
    return (
      <Link to={to} className={base} aria-disabled={disabled || undefined} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base} {...rest}>
      {children}
    </button>
  );
}
