// StatCard — a small dashboard-style stat tile (icon, label, big number).
// Used later in Customer/Admin overviews. Ready to reuse now.
//
// Props:
// - title: label, e.g. "Upcoming Appointments"
// - value: big number/text
// - subtitle: small text under value (optional)
// - icon: a lucide icon component, e.g. <CalendarDays />
// - trend: small text chip, e.g. "+3 this week" (optional)

export default function StatCard({ title, value, subtitle, icon: Icon, trend }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-soft">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {value}
          </p>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
        </div>

        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>

      {trend && <p className="mt-3 text-xs font-semibold text-teal-deep">{trend}</p>}
    </div>
  );
}
