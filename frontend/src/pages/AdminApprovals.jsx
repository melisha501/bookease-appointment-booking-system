// AdminApprovals — review provider accounts and services submitted by providers.
// Keeps the existing admin portal intact while adding an approval queue.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  Building2,
  Check,
  RefreshCw,
  Scissors,
  Store,
  UserRound,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';

function statusBadge(status) {
  if (status === 'approved') return { variant: 'success', label: 'Approved' };
  if (status === 'rejected') return { variant: 'danger', label: 'Rejected' };
  return { variant: 'warning', label: 'Pending' };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminApprovals() {
  const [tab, setTab] = useState('providers');
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [providerResult, serviceResult] = await Promise.allSettled([
      api.get('/admin/providers'),
      api.get('/admin/services'),
    ]);

    if (providerResult.status === 'fulfilled') {
      setProviders(Array.isArray(providerResult.value?.providers) ? providerResult.value.providers : []);
    }
    if (serviceResult.status === 'fulfilled') {
      setServices(Array.isArray(serviceResult.value?.services) ? serviceResult.value.services : []);
    }

    if (providerResult.status === 'rejected' && serviceResult.status === 'rejected') {
      setError(providerResult.reason?.message || 'Could not load the approval queue.');
    } else if (providerResult.status === 'rejected') {
      setError(`Could not load provider accounts: ${providerResult.reason?.message || 'Unknown error'}`);
    } else if (serviceResult.status === 'rejected') {
      setError(`Could not load services: ${serviceResult.reason?.message || 'Unknown error'}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingProviders = useMemo(
    () => providers.filter((provider) => provider.status === 'pending').length,
    [providers]
  );
  const pendingServices = useMemo(
    () => services.filter((service) => service.approvalStatus === 'pending').length,
    [services]
  );

  const filteredProviders = useMemo(
    () =>
      providerFilter === 'all'
        ? providers
        : providers.filter((provider) => provider.status === providerFilter),
    [providers, providerFilter]
  );

  const filteredServices = useMemo(
    () =>
      serviceFilter === 'all'
        ? services
        : services.filter((service) => (service.approvalStatus || 'approved') === serviceFilter),
    [services, serviceFilter]
  );

  const updateProvider = async (provider, payload) => {
    const key = `provider:${provider.dbId || provider.id}`;
    setBusyKey(key);
    setMessage('');
    setActionError('');
    try {
      const data = await api.patch(`/admin/providers/${encodeURIComponent(provider.dbId || provider.id)}`, payload);
      const updated = data?.provider;
      if (updated) {
        setProviders((current) =>
          current.map((item) =>
            (item.dbId || item.id) === (updated.dbId || updated.id) ? { ...item, ...updated } : item
          )
        );
      } else {
        await load();
      }
      setMessage(data?.message || 'Provider account updated.');
    } catch (err) {
      setActionError(err?.message || 'Could not update the provider account.');
    } finally {
      setBusyKey('');
    }
  };

  const updateService = async (service, status) => {
    const key = `service:${service.dbId || service.id}`;
    setBusyKey(key);
    setMessage('');
    setActionError('');
    try {
      const data = await api.patch(`/admin/services/${encodeURIComponent(service.dbId || service.id)}/approval`, {
        status,
      });
      const updated = data?.service;
      if (updated) {
        setServices((current) =>
          current.map((item) =>
            (item.dbId || item.id) === (updated.dbId || updated.id) ? { ...item, ...updated } : item
          )
        );
      } else {
        await load();
      }
      setMessage(data?.message || `Service marked ${status}.`);
    } catch (err) {
      setActionError(err?.message || 'Could not update the service approval.');
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Review queue
          </p>
          <h2 className="mt-2 text-h2">Provider approvals</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Approve provider accounts and provider-submitted services. Approved services become
            visible in the customer portal when the provider publishes them.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-sm font-medium text-teal-deep">
          {message}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {actionError}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Pending providers</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{pendingProviders}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Pending services</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{pendingServices}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Providers</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{providers.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('providers')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            tab === 'providers'
              ? 'bg-teal-deep text-white'
              : 'border border-line bg-white text-ink-soft hover:border-teal-200 hover:text-teal-deep'
          }`}
        >
          <Store className="h-4 w-4" aria-hidden="true" />
          Provider accounts
          <span className={`rounded-full px-1.5 text-xs ${tab === 'providers' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {providers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('services')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            tab === 'services'
              ? 'bg-teal-deep text-white'
              : 'border border-line bg-white text-ink-soft hover:border-teal-200 hover:text-teal-deep'
          }`}
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          Service approvals
          <span className={`rounded-full px-1.5 text-xs ${tab === 'services' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {services.length}
          </span>
        </button>
      </div>

      {tab === 'providers' ? (
        <Card padding="p-0" className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-ink">Provider accounts</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Approving a provider reveals their public profile and approved services.
              </p>
            </div>
            <select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              className="field w-full py-2 text-sm sm:w-44"
              aria-label="Filter providers by status"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {filteredProviders.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No provider accounts"
                description="Provider registrations appear here for review."
                icon={UserRound}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line/80">
              {filteredProviders.map((provider) => {
                const badge = statusBadge(provider.status);
                const busy = busyKey === `provider:${provider.dbId || provider.id}`;
                return (
                  <li key={provider.dbId || provider.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        {provider.logo ? (
                          <img
                            src={provider.logo}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                            {provider.type === 'ORGANIZATION' ? (
                              <Building2 className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <UserRound className="h-5 w-5" aria-hidden="true" />
                            )}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-bold text-ink">{provider.name}</p>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            {!provider.isActive ? <Badge variant="muted">Inactive</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {provider.type === 'ORGANIZATION' ? 'Organization' : 'Individual'} ·{' '}
                            {provider.ownerName || provider.ownerEmail || 'No owner details'} ·{' '}
                            {provider.serviceCount ?? 0} services
                          </p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {provider.email || provider.ownerEmail || 'No email'}
                            {provider.phone ? ` · ${provider.phone}` : ''}
                            {provider.address ? ` · ${provider.address}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-soft">
                            Registered {formatDate(provider.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {provider.status !== 'approved' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateProvider(provider, { status: 'approved' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-deep transition hover:bg-teal-100 disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Approve
                          </button>
                        ) : null}
                        {provider.status !== 'rejected' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateProvider(provider, { status: 'rejected' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            Reject
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateProvider(provider, { isActive: !provider.isActive })}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          {provider.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {provider.status === 'approved' && provider.isActive ? (
                          <Link
                            to={`/providers/${provider.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-deep transition hover:bg-teal-50"
                          >
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            View
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    {Array.isArray(provider.services) && provider.services.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/80 pt-3">
                        {provider.services.slice(0, 6).map((service) => {
                          const serviceBadge = statusBadge(service.approvalStatus);
                          return (
                            <span
                              key={service.id}
                              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface/60 px-2.5 py-1 text-[11px] text-ink-soft"
                            >
                              {service.name}
                              <Badge variant={serviceBadge.variant}>{serviceBadge.label}</Badge>
                            </span>
                          );
                        })}
                        {provider.services.length > 6 ? (
                          <span className="text-[11px] text-ink-soft">
                            +{provider.services.length - 6} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-ink">Provider-submitted services</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Approve services for the public catalog. Existing admin services are already approved.
              </p>
            </div>
            <select
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value)}
              className="field w-full py-2 text-sm sm:w-44"
              aria-label="Filter services by approval status"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All services</option>
            </select>
          </div>

          {filteredServices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nothing to review"
                description="No provider-submitted services match this filter."
                icon={Scissors}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line/80">
              {filteredServices.map((service) => {
                const badge = statusBadge(service.approvalStatus);
                const busy = busyKey === `service:${service.dbId || service.id}`;
                return (
                  <li key={service.dbId || service.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {service.image ? (
                        <img
                          src={service.image}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-white text-ink-soft">
                          <Scissors className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">{service.name}</p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <Badge variant={service.isActive ? 'default' : 'muted'}>
                            {service.isActive ? 'Published' : 'Unpublished'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                          {service.description}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {service.providerName || 'Provider'} · {service.price} · {service.duration} min ·{' '}
                          {service.categoryName || 'Uncategorized'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {service.approvalStatus !== 'approved' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateService(service, 'approved')}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-deep transition hover:bg-teal-100 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Approve
                        </button>
                      ) : null}
                      {service.approvalStatus !== 'rejected' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateService(service, 'rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          Reject
                        </button>
                      ) : null}
                      {service.providerName && service.providerId ? (
                        <Link
                          to={`/providers/${service.provider?.id || service.providerId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-deep transition hover:bg-teal-50"
                        >
                          <Store className="h-3.5 w-3.5" aria-hidden="true" />
                          Provider
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
