// Badge — small pill label for categories, statuses, and metadata.

const variants = {
  default: 'bg-teal-50 text-teal-deep ring-1 ring-teal-100/80',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  muted: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60',
  danger: 'bg-red-50 text-red-600 ring-1 ring-red-100',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
};

export default function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${variants[variant] || variants.default} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
