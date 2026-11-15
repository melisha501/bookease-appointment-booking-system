// StatCard — dashboard metric tile with an icon, value, and supporting label.

const tones = {
  teal: 'bg-teal-50 text-teal-deep ring-teal-100/70',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, tone = 'teal' }) {
  return (
    <div className="group rounded-2xl border border-line/90 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-soft sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-soft">{title}</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
            {value}
          </p>
          {subtitle ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.teal}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {trend ? (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-deep">
          {trend}
        </p>
      ) : null}
    </div>
  );
}
