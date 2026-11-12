// AdminCustomers — registered customers loaded from the backend (admin API).
// Supports server-side search (name/email), appointment filters, sorting,
// pagination, loading/error/empty states, and links to full customer details.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, Users } from 'lucide-react';

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

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setHasAppointments('all');
    setSort('newest');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {loading ? (
            'Loading customers…'
          ) : (
            <>
              <span className="font-bold text-ink">{pagination.total}</span>{' '}
              {pagination.total === 1 ? 'customer' : 'customers'}
              {hasActiveFilters ? ' matching your filters' : ' registered'}
            </>
          )}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </Button>
        </div>
      )}

      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search customers by name or email"
              className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-teal-brand focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-100"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {customerFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                setHasAppointments(filter.id);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                hasAppointments === filter.id
                  ? 'bg-teal-deep text-white'
                  : 'border border-line bg-white text-ink-soft hover:bg-slate-100 hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {!error && (loading ? (
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
            <Button variant="secondary" onClick={resetFilters}>Clear filters</Button>
          )}
        </EmptyState>
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Registered</th>
                  <th className="px-5 py-3">Appointments</th>
                  <th className="px-5 py-3">Last Appointment</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-deep">
                          {initials(customer.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-ink">{customer.name}</p>
                          <p className="truncate text-xs text-ink-soft">{customer.email}</p>
                          <p className="text-xs text-ink-soft">
                            {customer.phone || 'Phone not provided'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                      {formatRegistered(customer.registeredAt)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink">{customer.totalAppointments}</p>
                      <p className="text-xs text-ink-soft">
                        {customer.completedAppointments} completed · {customer.cancelledAppointments} cancelled
                      </p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                      {formatAppointmentDate(customer.lastAppointmentDate)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/customers/${encodeURIComponent(customer.id)}`}
                        className="font-semibold whitespace-nowrap text-teal-deep hover:underline"
                      >
                        View details →
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
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
