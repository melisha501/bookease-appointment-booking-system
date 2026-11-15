// Specialists — browse every professional with live search, specialty filter
// and sorting. Filter state is kept in the URL for shareable links.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, UserRound, X } from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import SpecialistCard from '../components/SpecialistCard';
import { useDemo } from '../store/DemoContext';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'name', label: 'Name A–Z' },
];

function SpecialistSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="skeleton aspect-[5/4] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton mt-4 h-9 w-full" />
      </div>
    </div>
  );
}

export default function Specialists() {
  const { specialists, services, catalogLoading, catalogError, refreshCatalog } = useDemo();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const activeSpecialty = searchParams.get('specialty') || 'all';
  const sort = searchParams.get('sort') || 'recommended';

  const list = useMemo(() => (Array.isArray(specialists) ? specialists : []), [specialists]);
  const serviceMap = useMemo(
    () => new Map((Array.isArray(services) ? services : []).map((service) => [service.id, service.name])),
    [services]
  );

  const specialties = useMemo(() => {
    const unique = new Map();
    list.forEach((specialist) => {
      const value = (specialist.specialty || '').trim();
      if (value) unique.set(value.toLowerCase(), value);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || (key === 'sort' && value === 'recommended')) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = list.filter((specialist) => {
      if (!term) return activeSpecialty === 'all' || specialist.specialty === activeSpecialty;
      const haystack = [specialist.name, specialist.title, specialist.specialty, specialist.bio]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = haystack.includes(term);
      const matchesSpecialty =
        activeSpecialty === 'all' || specialist.specialty === activeSpecialty;
      return matchesSearch && matchesSpecialty;
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'experience':
          return (Number(b.experience) || 0) - (Number(a.experience) || 0);
        case 'name':
          return String(a.name || '').localeCompare(String(b.name || ''));
        default:
          return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
    });
    return sorted;
  }, [list, query, activeSpecialty, sort]);

  const showSkeletons = catalogLoading && list.length === 0;
  const hasFilters = Boolean(query || activeSpecialty !== 'all' || sort !== 'recommended');

  return (
    <>
      <PageHeader
        eyebrow="Trusted professionals"
        title="Meet our specialists"
        description="Experienced professionals across every service. Explore profiles and book with the person who suits you best."
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
              placeholder="Search by name, role or specialty…"
              aria-label="Search specialists"
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

          <div className="relative">
            <label htmlFor="specialist-sort" className="sr-only">
              Sort specialists
            </label>
            <ArrowUpDown
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <select
              id="specialist-sort"
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
      </PageHeader>

      <section className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => updateParam('specialty', 'all')}
              className={`chip shrink-0 ${activeSpecialty === 'all' ? 'chip-active' : ''}`}
              aria-pressed={activeSpecialty === 'all'}
            >
              All specialties
            </button>
            {specialties.map((specialty) => (
              <button
                key={specialty}
                type="button"
                onClick={() => updateParam('specialty', specialty)}
                className={`chip shrink-0 ${activeSpecialty === specialty ? 'chip-active' : ''}`}
                aria-pressed={activeSpecialty === specialty}
              >
                {specialty}
              </button>
            ))}
          </div>

          <p className="shrink-0 text-sm font-medium text-ink-soft" aria-live="polite">
            {showSkeletons
              ? 'Loading specialists…'
              : `${filtered.length} specialist${filtered.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {query ? (
              <button type="button" onClick={() => updateParam('q', '')} className="chip px-3 py-1 text-xs">
                “{query}” <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {activeSpecialty !== 'all' ? (
              <button
                type="button"
                onClick={() => updateParam('specialty', 'all')}
                className="chip px-3 py-1 text-xs"
              >
                {activeSpecialty} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-teal-deep underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          {showSkeletons ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SpecialistSkeleton key={index} />
              ))}
            </div>
          ) : list.length === 0 ? (
            catalogError ? (
              <EmptyState title="Could not load specialists" description={catalogError} icon={UserRound}>
                <Button onClick={refreshCatalog} variant="secondary">
                  Try again
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                title="No specialists available"
                description="Profiles will appear here as soon as they are added. Please check back later."
                icon={UserRound}
              />
            )
          ) : (
            <>
              {catalogError ? (
                <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <span>Some specialist data could not be refreshed. {catalogError}</span>
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
                  title="No specialists found"
                  description="Try a different keyword or clear the specialty filter."
                  icon={Search}
                >
                  <Button onClick={clearFilters} variant="secondary">
                    Clear filters
                  </Button>
                </EmptyState>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((specialist) => (
                    <SpecialistCard
                      key={specialist.id}
                      specialist={specialist}
                      serviceNames={(Array.isArray(specialist.serviceIds)
                        ? specialist.serviceIds
                        : []
                      )
                        .map((id) => serviceMap.get(id))
                        .filter(Boolean)}
                    />
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
