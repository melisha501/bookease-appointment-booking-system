// ProviderDetails — public provider profile with approved services and specialists.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Phone,
  Store,
  UserRound,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ServiceCard from '../components/ServiceCard';

function ProfileSkeleton() {
  return (
    <div className="container-page py-8" aria-busy="true">
      <div className="skeleton h-4 w-48" />
      <div className="skeleton mt-6 h-44 w-full rounded-3xl" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="skeleton h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function ProviderDetails() {
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? '' : 'Provider not found.');

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`/providers/${encodeURIComponent(id)}`);
        if (alive) setProvider(data?.provider || null);
      } catch (err) {
        if (alive) setError(err?.message || 'Could not load this provider.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <ProfileSkeleton />;

  if (error || !provider) {
    return (
      <div className="container-page py-14">
        <EmptyState
          title="Provider not available"
          description={error || 'This provider profile is not published yet.'}
          icon={Store}
        >
          <Button to="/providers" variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to providers
          </Button>
        </EmptyState>
      </div>
    );
  }

  const services = Array.isArray(provider.services) ? provider.services : [];
  const specialists = Array.isArray(provider.specialists) ? provider.specialists : [];
  const isOrganization = provider.type === 'ORGANIZATION';

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-soft">
        <Link to="/" className="transition-colors hover:text-teal-deep">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link to="/providers" className="transition-colors hover:text-teal-deep">
          Providers
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="line-clamp-1 font-medium text-ink" aria-current="page">
          {provider.name}
        </span>
      </nav>

      <section className="surface-card mt-6 overflow-hidden">
        <div className="bg-gradient-to-br from-teal-50/90 via-white to-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {provider.logo ? (
              <img
                src={provider.logo}
                alt=""
                className="h-20 w-20 shrink-0 rounded-3xl border border-line bg-white object-cover shadow-soft"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-teal-deep ring-1 ring-teal-100">
                {isOrganization ? (
                  <Building2 className="h-9 w-9" aria-hidden="true" />
                ) : (
                  <UserRound className="h-9 w-9" aria-hidden="true" />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h1">{provider.name}</h1>
                <Badge>{isOrganization ? 'Organization' : 'Individual practitioner'}</Badge>
                <Badge variant="success">Approved provider</Badge>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
                {provider.description ||
                  'This provider has not added a description yet. Browse their approved services below.'}
              </p>

              <dl className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                {provider.email ? (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Mail className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                    <a href={`mailto:${provider.email}`} className="truncate hover:text-teal-deep hover:underline">
                      {provider.email}
                    </a>
                  </div>
                ) : null}
                {provider.phone ? (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Phone className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                    <a href={`tel:${provider.phone}`} className="hover:text-teal-deep hover:underline">
                      {provider.phone}
                    </a>
                  </div>
                ) : null}
                {provider.address ? (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <MapPin className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                    <span className="truncate">{provider.address}</span>
                  </div>
                ) : null}
                {provider.website ? (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Globe className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                    <a
                      href={provider.website}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-teal-deep hover:underline"
                    >
                      {provider.website}
                    </a>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-h2">Services</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Approved and published services from this provider.
            </p>
          </div>
          <Badge variant="muted">{services.length} available</Badge>
        </div>

        {services.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No published services yet"
              description="This provider is approved, but their services are still being prepared or reviewed."
              icon={Store}
            >
              <Button to="/services" variant="secondary">
                Browse all services
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </section>

      {specialists.length ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-h2">Specialists</h2>
          <p className="mt-1 text-sm text-ink-soft">The team customers can book with.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {specialists.map((specialist) => (
              <li
                key={specialist.id}
                className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white p-4 shadow-soft"
              >
                {specialist.image ? (
                  <img
                    src={specialist.image}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-line"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100">
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{specialist.name}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {specialist.title || specialist.specialty || 'Specialist'}
                  </p>
                </div>
                <Link
                  to={`/specialists/${specialist.id}`}
                  className="shrink-0 rounded-lg p-2 text-ink-soft transition hover:bg-surface hover:text-teal-deep"
                  aria-label={`View ${specialist.name}'s profile`}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
        <Button to="/providers" variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All providers
        </Button>
        <Button to="/services">Browse all services</Button>
      </div>
    </div>
  );
}
