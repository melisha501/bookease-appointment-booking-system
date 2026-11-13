// SpecialistDetails — single specialist page at /specialists/:id
// Fetches specialist details (and available services) from the backend API.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CalendarCheck,
  Clock,
  Sparkles,
  Star,
  User,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { useDemo } from '../store/DemoContext';

export default function SpecialistDetails() {
  const { id } = useParams();
  const { services: allServices } = useDemo();
  const [specialist, setSpecialist] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? '' : 'Specialist not found.');

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`/specialists/${encodeURIComponent(id)}`);
        if (alive) setSpecialist(data?.specialist || null);
      } catch (err) {
        if (alive) setError(err?.message || 'Failed to load specialist details.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const availableServices = useMemo(() => {
    if (Array.isArray(specialist?.services) && specialist.services.length) return specialist.services;
    const ids = Array.isArray(specialist?.serviceIds) ? specialist.serviceIds : [];
    const map = new Map((Array.isArray(allServices) ? allServices : []).map((s) => [s.id, s]));
    return ids.map((sid) => map.get(sid)).filter(Boolean);
  }, [specialist, allServices]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="animate-pulse">
          <div className="h-6 w-48 rounded bg-slate-100" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-100" />
          <div className="mt-2 h-4 w-full max-w-lg rounded bg-slate-100" />
        </Card>
      </div>
    );
  }

  if (error || !specialist) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <EmptyState
          title={error ? 'Could not load specialist' : 'Specialist not found'}
          description={error || 'This specialist profile may be unavailable. Browse all specialists instead.'}
          icon={User}
        >
          <Button to="/specialists" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back to Specialists
          </Button>
        </EmptyState>
      </div>
    );
  }

  const schedule = specialist.schedule;
  const bookTo = `/booking?specialist=${encodeURIComponent(specialist.id)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/specialists"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-slate-300 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Specialists
        </Link>
        <Button to={bookTo} size="sm">
          <CalendarCheck className="h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card padding="p-0" className="overflow-hidden">
          <div className="relative aspect-[4/5] w-full bg-slate-100">
            {specialist.image ? (
              <img
                src={specialist.image}
                alt={specialist.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 text-ink-soft">
                <div className="text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line">
                    <User className="h-10 w-10 text-teal-brand/80" />
                  </div>
                  <p className="mt-3 text-sm font-medium">No profile photo</p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent p-5 pt-16">
              {Number(specialist?.rating) > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {specialist.rating} rating
                </span>
              ) : null}
            </div>
          </div>
          <div className="p-6">
            <Badge>{specialist.specialty || 'Specialist'}</Badge>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{specialist.name}</h1>
            <p className="mt-1 text-base font-semibold text-teal-deep">{specialist.title}</p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
                <Award className="h-5 w-5 text-teal-deep" />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Qualifications</p>
                  <p className="text-sm font-medium text-ink">{specialist.title || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
                <Briefcase className="h-5 w-5 text-teal-deep" />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Experience</p>
                  <p className="text-sm font-medium text-ink">
                    {Number(specialist?.experience) > 0 ? `${specialist.experience} years` : 'Experience details available on request'}
                  </p>
                </div>
              </div>
              {schedule?.start ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
                  <Clock className="h-5 w-5 text-teal-deep" />
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Typical Hours</p>
                    <p className="text-sm font-medium text-ink">
                      {schedule.start} – {schedule.end}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-6">
              <Button to={bookTo} fullWidth>
                <CalendarCheck className="h-5 w-5" />
                Book with {specialist.name.split(' ')[0] || 'Specialist'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-deep" />
              <h2 className="text-xl font-bold text-ink">Biography</h2>
            </div>
            <p className="mt-4 leading-relaxed text-ink-soft">
              {specialist.bio?.trim()
                ? specialist.bio
                : `${specialist.name} is a trusted ${specialist.specialty || 'specialist'} providing professional care and a comfortable appointment experience. Contact the studio for more details about qualifications and consultation approach.`}
            </p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">Available Services</h2>
                <p className="mt-1 text-sm text-ink-soft">Services this specialist can provide.</p>
              </div>
              <Badge variant="muted">{availableServices.length} service{availableServices.length === 1 ? '' : 's'}</Badge>
            </div>
            {availableServices.length === 0 ? (
              <p className="mt-5 text-sm text-ink-soft">No services are currently assigned to this specialist.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {availableServices.map((service) => (
                  <div
                    key={service.id}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-surface/40 p-4 transition-all hover:border-teal-100 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{service.name}</p>
                        {service.categoryName ? (
                          <p className="mt-0.5 text-xs font-medium text-teal-deep">{service.categoryName}</p>
                        ) : null}
                      </div>
                      {service.price ? (
                        <span className="shrink-0 text-sm font-bold text-ink">{service.price}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{service.description || 'Service details available on the service page.'}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="text-xs font-medium text-ink-soft">
                        {service.duration ? `${service.duration} mins` : ''}
                      </span>
                      <Link
                        to={`/services/${service.id}`}
                        className="text-sm font-semibold text-teal-deep hover:underline"
                      >
                        View Service
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-teal-100 bg-gradient-to-r from-teal-50/70 to-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Ready to book?</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Continue to the booking flow with {specialist.name} preselected.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button to="/specialists" variant="secondary">
                  Back to Specialists
                </Button>
                <Button to={bookTo}>
                  <CalendarCheck className="h-4 w-4" />
                  Book Appointment
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}