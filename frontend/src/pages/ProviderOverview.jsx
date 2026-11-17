// ProviderOverview — provider dashboard landing page.
// Shows the provider's approval state, catalog stats, and recent bookings.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  Image as ImageIcon,
  Plus,
  Scissors,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

const STATUS_COPY = {
  pending: {
    title: 'Your provider profile is awaiting approval',
    body: 'An administrator reviews new provider profiles. You can prepare services now, but they stay hidden from customers until your profile is approved.',
    variant: 'warning',
  },
  rejected: {
    title: 'Your provider profile was rejected',
    body: 'Contact BookEase support to review your profile details. You can still sign in, but new services cannot be submitted.',
    variant: 'danger',
  },
  approved: {
    title: 'Your provider profile is approved',
    body: 'Approved and published services appear in the customer booking portal.',
    variant: 'success',
  },
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatTile({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-teal-deep/70" aria-hidden="true" /> : null}
      </div>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export default function ProviderOverview() {
  const [data, setData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noProfile, setNoProfile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNoProfile(false);
    try {
      const profile = await api.get('/providers/me');
      setData(profile);
      try {
        const bookings = await api.get('/providers/me/appointments');
        setAppointments(Array.isArray(bookings?.appointments) ? bookings.appointments : []);
      } catch {
        setAppointments([]);
      }
    } catch (err) {
      if (err?.data?.code === 'NO_PROVIDER_PROFILE' || err?.status === 404) {
        setNoProfile(true);
      } else {
        setError(err?.message || 'Could not load your provider dashboard.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (noProfile) {
    return (
      <EmptyState
        title="No provider profile yet"
        description="This account does not have a linked provider profile. Create one to start listing services."
        icon={UserRound}
      >
        <Button to="/provider/register">Create a provider profile</Button>
      </EmptyState>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Could not load your dashboard"
          description={error}
          icon={ClipboardList}
        >
          <Button onClick={load}>Try again</Button>
        </EmptyState>
      </div>
    );
  }

  const provider = data?.provider || {};
  const services = Array.isArray(data?.services) ? data.services : [];
  const stats = data?.stats || {};
  const statusCopy = STATUS_COPY[provider.status] || STATUS_COPY.pending;
  const pendingServices = services.filter((service) => service.approvalStatus === 'pending');
  const recent = appointments.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {provider.logo ? (
            <img
              src={provider.logo}
              alt=""
              className="h-14 w-14 rounded-2xl border border-line bg-white object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
          <div>
            <p className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
              Provider dashboard
            </p>
            <h2 className="mt-1 text-h2">{provider.name}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {provider.type === 'ORGANIZATION' ? 'Organization' : 'Individual practitioner'}
              {provider.address ? ` · ${provider.address}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button to="/provider/services" variant="secondary">
            <Scissors className="h-4 w-4" aria-hidden="true" />
            Manage services
          </Button>
          <Button to="/provider/services">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add service
          </Button>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-4 sm:p-5 ${
          statusCopy.variant === 'success'
            ? 'border-teal-100 bg-teal-50/70'
            : statusCopy.variant === 'danger'
              ? 'border-red-100 bg-red-50/70'
              : 'border-amber-100 bg-amber-50/70'
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ${
                statusCopy.variant === 'success'
                  ? 'text-teal-deep'
                  : statusCopy.variant === 'danger'
                    ? 'text-red-600'
                    : 'text-amber-700'
              }`}
            >
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">{statusCopy.title}</h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-soft">{statusCopy.body}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant={statusCopy.variant}>
              Profile {provider.status || 'pending'}
            </Badge>
            {!provider.isActive ? <Badge variant="muted">Inactive</Badge> : null}
            <Link
              to="/provider/profile"
              className="text-xs font-bold text-teal-deep hover:underline"
            >
              Edit profile
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Services" value={stats.services ?? services.length} icon={Scissors} />
        <StatTile
          label="Published"
          value={stats.publishedServices ?? 0}
          hint="Visible to customers"
          icon={BadgeCheck}
        />
        <StatTile
          label="Awaiting review"
          value={stats.pendingServices ?? pendingServices.length}
          hint="Service approvals"
          icon={Clock}
        />
        <StatTile
          label="Appointments"
          value={stats.appointments ?? appointments.length}
          hint="All time"
          icon={CalendarDays}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card padding="p-0" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">Recent appointments</h3>
              <p className="mt-0.5 text-xs text-ink-soft">The latest bookings for your services.</p>
            </div>
            <Link to="/provider/appointments" className="text-xs font-bold text-teal-deep hover:underline">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No appointments yet"
                description="Customer bookings for your published services will appear here."
                icon={CalendarDays}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line/80 border-t border-line/80">
              {recent.map((item) => (
                <li key={item.reference || item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{item.service}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {item.customer || 'Customer'} · {formatDate(item.date)} · {item.time}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-base font-bold text-ink">Profile at a glance</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-soft">Status</dt>
                <dd>
                  <Badge variant={statusCopy.variant}>{provider.status || 'pending'}</Badge>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="text-ink-soft">Contact email</dt>
                <dd className="truncate text-right font-semibold text-ink">
                  {provider.email || provider.ownerEmail || 'Not set'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="text-ink-soft">Phone</dt>
                <dd className="text-right font-semibold text-ink">{provider.phone || 'Not set'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line/80 pt-2.5">
                <dt className="text-ink-soft">Public page</dt>
                <dd className="text-right">
                  {provider.status === 'approved' && provider.isActive ? (
                    <Link
                      to={`/providers/${provider.id}`}
                      className="font-semibold text-teal-deep hover:underline"
                    >
                      View public profile
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-soft">Available after approval</span>
                  )}
                </dd>
              </div>
            </dl>
            <Button to="/provider/profile" variant="secondary" size="sm" fullWidth className="mt-4">
              Update provider profile
            </Button>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink">Needs attention</h3>
              <Button to="/provider/services" variant="ghost" size="sm">
                Open
              </Button>
            </div>
            {pendingServices.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/60 px-3.5 py-4 text-xs leading-relaxed text-ink-soft">
                No services are waiting for review. New or rejected services appear here until an
                administrator approves them.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pendingServices.slice(0, 4).map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface/60 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-ink">{service.name}</span>
                    <Badge variant="warning">Pending</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
