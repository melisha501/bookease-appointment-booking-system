// AdminCustomers — registered customers loaded from the backend (admin API).
// Supports server-side search (name/email), appointment filters, sorting,
// pagination, loading/error/empty states, and links to full customer details.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';

const PAGE_SIZE = 20;

const customerFilters = [
  { id: 'all', label: 'All customers' },
  { id: 'yes', label: 'With appointments' },
  { id: 'no', label: 'No appointments' },
];

const sortOptions = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'name', label: 'Name A–Z' },
];

function formatRegistered(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAppointmentDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

const emptyPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hasAppointments, setHasAppointments] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce typing so the API is not called on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (hasAppointments !== 'all') params.set('hasAppointments', hasAppointments);
        params.set('sort', sort);
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));

        const data = await api.get(`/customers?${params.toString()}`);
        if (!alive) return;
        setCustomers(Array.isArray(data?.customers) ? data.customers : []);
        setPagination(data?.pagination || emptyPagination);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Failed to load customers.');
        setCustomers([]);
        setPagination(emptyPagination);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [debouncedSearch, hasAppointments, sort, page, reloadKey]);

  const hasActiveFilters = Boolean(debouncedSearch) || hasAppointments !== 'all' || sort !== 'newest';
  const searchPending = search.trim() !== debouncedSearch;

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setHasAppointments('all');
    setSort('newest');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Relationships
          </p>
          <h2 className="mt-2 text-h2">Customers</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Search registered accounts, review booking activity, and open a customer profile to see
            their full appointment history.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Registered</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {loading ? '—' : pagination.total}
          </p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">On this page</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{loading ? '—' : customers.length}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Pages</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {loading ? '—' : Math.max(1, pagination.totalPages)}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      )}

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search customers by name or email"
              className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-teal-brand focus:ring-4 focus:ring-teal-100/70"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-ink">
              <SlidersHorizontal className="h-4 w-4 text-teal-deep" aria-hidden="true" />
              Sort
            </span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-teal-brand focus:ring-4 focus:ring-teal-100/70"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {customerFilters.map((filter) => {
            const active = hasAppointments === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setHasAppointments(filter.id);
                  setPage(1);
                }}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-teal-deep text-white shadow-[0_10px_22px_-14px_rgba(15,118,110,0.8)]'
                    : 'border border-line bg-white text-ink-soft hover:border-slate-300 hover:bg-slate-50 hover:text-ink'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
          <span>
            {loading ? (
              searchPending ? (
                'Searching…'
              ) : (
                'Loading customers…'
              )
            ) : (
              <>
                <span className="font-bold text-ink">{pagination.total}</span>{' '}
                {pagination.total === 1 ? 'customer' : 'customers'}
                {hasActiveFilters ? ' matching your filters' : ' registered'}
              </>
            )}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-teal-deep hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {!error &&
        (loading ? (
          <Card padding="p-0" className="overflow-hidden">
            <div className="animate-pulse divide-y divide-line">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-slate-200" />
                    <div className="h-3 w-56 rounded bg-slate-100" />
                  </div>
                  <div className="hidden h-3 w-24 rounded bg-slate-100 sm:block" />
                  <div className="hidden h-3 w-16 rounded bg-slate-100 md:block" />
                </div>
              ))}
            </div>
          </Card>
        ) : customers.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No customers match your filters' : 'No customers yet'}
            description={
              hasActiveFilters
                ? 'Try a different name or email, or clear the appointment filter.'
                : 'Registered customers will appear here after they create an account.'
            }
            icon={Users}
          >
            {hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </EmptyState>
        ) : (
          <Card padding="p-0" className="overflow-hidden">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Registered</th>
                    <th className="px-5 py-3">Appointments</th>
                    <th className="px-5 py-3">Last appointment</th>
                    <th className="px-5 py-3 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-line transition last:border-0 hover:bg-surface/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-deep ring-1 ring-teal-100/70">
                            {initials(customer.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-ink">{customer.name}</p>
                            <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                              <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{customer.email}</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                              <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {customer.phone || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                        {formatRegistered(customer.registeredAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-deep ring-1 ring-teal-100/70">
                            <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {customer.totalAppointments}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                          {customer.completedAppointments} completed · {customer.cancelledAppointments}{' '}
                          cancelled
                        </p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                        {formatAppointmentDate(customer.lastAppointmentDate)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/customers/${encodeURIComponent(customer.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-teal-deep transition hover:bg-teal-50"
                        >
                          View details
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {!error && !loading && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Page <span className="font-bold text-ink">{pagination.page}</span> of{' '}
            <span className="font-bold text-ink">{pagination.totalPages}</span>
            <span className="hidden sm:inline"> · {pagination.total} customers</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
