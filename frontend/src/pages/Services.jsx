// Services — page listing ALL services with search + category filter.

import { useState } from 'react';
import { Search } from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ServiceCard from '../components/ServiceCard';
import { useDemo } from '../store/DemoContext';

export default function Services() {
  const { services, categories, catalogLoading, catalogError, refreshCatalog } = useDemo();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Filter: search text matches name/description, category must match.
  const filtered = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(search.toLowerCase()) ||
      service.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'all' || service.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Header */}
      <div className="page-hero">
        <p className="text-sm font-semibold tracking-wide text-teal-deep uppercase">Service catalog</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">Find the right service</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Browse services, compare pricing and duration, and open details to book with the right specialist.
        </p>
        <div className="mt-6 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search services by name or description…"
              aria-label="Search services"
              className="input-modern rounded-full py-3.5 pr-4 pl-11"
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeCategory === category.id
                ? 'bg-teal-deep text-white'
                : 'border border-line bg-white text-ink-soft hover:bg-slate-100 hover:text-ink'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-10">
        {catalogLoading ? (
          <p className="text-center text-sm text-ink-soft">Loading services…</p>
        ) : catalogError ? (
          <EmptyState title="Could not load services" description={catalogError} icon={Search}>
            <Button onClick={refreshCatalog} variant="secondary">Try again</Button>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No services found"
            description="Try a different search word or choose another category."
            icon={Search}
          >
            <Button
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
              }}
              variant="secondary"
            >
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
      </div>
    </div>
  );
}
