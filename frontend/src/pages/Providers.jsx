// Providers — public directory of approved service providers.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  MapPin,
  RefreshCw,
  Search,
  Store,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

function ProviderCard({ provider }) {
  return (
    <article className="surface-card group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="flex items-start gap-4 p-5">
        {provider.logo ? (
          <img
            src={provider.logo}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-2xl border border-line object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
            {provider.type === 'ORGANIZATION' ? (
              <Building2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <UserRound className="h-7 w-7" aria-hidden="true" />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 text-base font-bold text-ink">{provider.name}</h3>
            <Badge variant={provider.type === 'ORGANIZATION' ? 'default' : 'muted'}>
              {provider.type === 'ORGANIZATION' ? 'Organization' : 'Individual'}
            </Badge>
          </div>
          {provider.address ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{provider.address}</span>
            </p>
          ) : null}
        </div>
      </div>

      <p className="line-clamp-3 px-5 text-sm leading-relaxed text-ink-soft">
        {provider.description || 'Browse this provider’s approved services and specialists.'}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="muted">
            {provider.serviceCount ?? (Array.isArray(provider.services) ? provider.services.length : 0)} services
          </Badge>
          <Badge variant="muted">
            {Array.isArray(provider.specialists) ? provider.specialists.length : 0} specialists
          </Badge>
        </div>
        <Link
          to={`/providers/${provider.id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal-deep px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
        >
          View
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/providers');
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
    } catch (err) {
      setError(err?.message || 'Could not load providers.');
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((provider) =>
      [provider.name, provider.description, provider.address, provider.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [providers, search]);

  return (
    <div className="container-page py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Provider directory
          </p>
          <h1 className="mt-2 text-h1">Browse service providers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Discover approved independent practitioners and organizations on BookEase, then explore
            their services and specialists.
          </p>
        </div>
        <Button to="/provider/register" variant="secondary">
          <Store className="h-4 w-4" aria-hidden="true" />
          Become a service provider
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers by name or location…"
            aria-label="Search providers"
            className="field py-2.5 pr-3 pl-10"
          />
        </div>
        <p className="text-xs font-semibold text-ink-soft">
          {loading ? 'Loading providers…' : `${filtered.length} approved provider${filtered.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8">
          <EmptyState title="Could not load providers" description={error} icon={Store}>
            <Button onClick={load}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </EmptyState>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={providers.length === 0 ? 'No providers published yet' : 'No matching providers'}
            description={
              providers.length === 0
                ? 'Approved providers will appear here. Providers can create an account and submit services for review.'
                : 'Try a different name, location, or provider type.'
            }
            icon={Store}
          >
            {providers.length === 0 ? (
              <Button to="/provider/register">Become a service provider</Button>
            ) : null}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}
    </div>
  );
}
