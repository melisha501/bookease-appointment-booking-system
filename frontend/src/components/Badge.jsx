// Badge — small pill label, e.g. for status or category.
// Props:
// - children: label text
// - variant: "default" (teal) | "success" | "warning" | "muted" | "danger" | "rejected"

const variants = {
  default: 'bg-teal-50 text-teal-deep',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  muted: 'bg-slate-100 text-slate-600',
  danger: 'bg-red-50 text-red-600',
  rejected: 'bg-rose-50 text-rose-700',
};

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
