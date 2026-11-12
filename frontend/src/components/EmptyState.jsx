// EmptyState — friendly message when a list has no results.
// Props:
// - title, description: text
// - icon: optional lucide icon component
// - children: optional action button (e.g. <Button>)

export default function EmptyState({ title, description, icon: Icon, children }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/90 px-6 py-14 text-center shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)]">
      {Icon && (
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h3 className="mt-5 text-lg font-bold tracking-tight text-ink">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
