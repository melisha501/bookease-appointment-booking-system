// EmptyState — friendly, actionable placeholder when a list has no results.

export default function EmptyState({ title, description, icon: Icon, children, className = '' }) {
  return (
    <div
      className={`rounded-3xl border border-dashed border-line bg-white/90 px-6 py-12 text-center shadow-soft sm:py-14 ${className}`}
    >
      {Icon ? (
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="mt-5 text-h3">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}
