// PageHeader — consistent page introduction for public pages.

export default function PageHeader({ eyebrow, title, description, actions, children, className = '' }) {
  return (
    <section className={`hero-surface border-b-0 ${className}`}>
      <div className="container-page py-10 sm:py-14 lg:py-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl animate-fade-up">
            {eyebrow ? (
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
                {eyebrow}
              </span>
            ) : null}
            <h1 className="mt-3 text-h1 sm:text-[2.65rem]">{title}</h1>
            {description ? <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {children ? <div className="mt-8 animate-fade-in">{children}</div> : null}
      </div>
    </section>
  );
}
