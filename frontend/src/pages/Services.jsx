// Services — searchable, filterable catalog of every service.
// Filters live in the URL (?q=&category=&sort=) so Home, category tiles,
// footer links and shared URLs all land on the same filtered view.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import ServiceCard from '../components/ServiceCard';
import { useDemo } from '../store/DemoContext';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'duration', label: 'Shortest duration' },
  { value: 'name', label: 'Name A–Z' },
];

function numericPrice(service) {
  if (Number.isFinite(Number(service?.priceNpr))) return Number(service.priceNpr);
  const parsed = Number(String(service?.price || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ServiceSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton mt-4 h-9 w-full" />
      </div>
    </div>
  );
}

export default function Services() {
  const { services, categories, catalogLoading, catalogError, refreshCatalog } = useDemo();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const activeCategory = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'recommended';
  const serviceList = useMemo(() => (Array.isArray(services) ? services : []), [services]);
  const categoryList = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || (key === 'sort' && value === 'recommended')) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });

  const activeCategoryName =
    categoryList.find((category) => category.id === activeCategory)?.name || '';

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = serviceList.filter((service) => {
      const inName = (service.name || '').toLowerCase().includes(term);
      const inDescription = (service.description || '').toLowerCase().includes(term);
      const inCategory = (service.categoryName || '').toLowerCase().includes(term);
      const matchesSearch = !term || inName || inDescription || inCategory;
      const matchesCategory = activeCategory === 'all' || service.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return numericPrice(a) - numericPrice(b);
        case 'price-desc':
          return numericPrice(b) - numericPrice(a);
        case 'duration':
          return (Number(a.duration) || 0) - (Number(b.duration) || 0);
        case 'name':
          return String(a.name || '').localeCompare(String(b.name || ''));
        default:
          return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
    });
    return sorted;
  }, [serviceList, query, activeCategory, sort]);

  const hasFilters = Boolean(query || activeCategory !== 'all' || sort !== 'recommended');
  const showSkeletons = catalogLoading && serviceList.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Service catalog"
        title="Find the right service"
        description="Browse treatments, compare price and duration, then book with a specialist who fits your schedule."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="Search services, categories or keywords…"
              aria-label="Search services"
              className="field rounded-full py-3.5 pr-11 pl-11"
            />
            {query ? (
              <button
                type="button"
                onClick={() => updateParam('q', '')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="service-sort" className="sr-only">
              Sort services
            </label>
            <div className="relative">
              <ArrowUpDown
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <select
                id="service-sort"
                value={sort}
                onChange={(event) => updateParam('sort', event.target.value)}
                className="field appearance-none py-2.5 pr-9 pl-10 text-[13px] font-semibold"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </PageHeader>

      <section className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => updateParam('category', 'all')}
              className={`chip shrink-0 ${activeCategory === 'all' ? 'chip-active' : ''}`}
              aria-pressed={activeCategory === 'all'}
            >
              All services
            </button>
            {categoryList
              .filter((category) => category.id !== 'all')
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => updateParam('category', category.id)}
                  className={`chip shrink-0 ${activeCategory === category.id ? 'chip-active' : ''}`}
                  aria-pressed={activeCategory === category.id}
                >
                  {category.name}
                </button>
              ))}
          </div>

          <p className="shrink-0 text-sm font-medium text-ink-soft" aria-live="polite">
            {showSkeletons
              ? 'Loading services…'
              : `${filtered.length} service${filtered.length === 1 ? '' : 's'}${
                  activeCategoryName && activeCategory !== 'all' ? ` in ${activeCategoryName}` : ''
                }`}
          </p>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Active filters
            </span>
            {query ? (
              <button type="button" onClick={() => updateParam('q', '')} className="chip px-3 py-1 text-xs">
                “{query}” <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {activeCategory !== 'all' ? (
              <button
                type="button"
                onClick={() => updateParam('category', 'all')}
                className="chip px-3 py-1 text-xs"
              >
                {activeCategoryName || activeCategory} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-teal-deep underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          {showSkeletons ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ServiceSkeleton key={index} />
              ))}
            </div>
          ) : serviceList.length === 0 ? (
            catalogError ? (
              <EmptyState title="Could not load services" description={catalogError} icon={Search}>
                <Button onClick={refreshCatalog} variant="secondary">
                  Try again
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                title="No services available"
                description="The service catalog is empty right now. Please check back later."
                icon={Search}
              />
            )
          ) : (
            <>
              {catalogError ? (
                <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <span>Some services could not be refreshed. {catalogError}</span>
                  <button
                    type="button"
                    onClick={refreshCatalog}
                    className="shrink-0 font-semibold underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <EmptyState
                  title="No services found"
                  description="Try a different keyword or choose another category."
                  icon={Search}
                >
                  <Button onClick={clearFilters} variant="secondary">
                    Clear filters
                  </Button>
                </EmptyState>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
