// Home — landing page for the public website.
// Services, specialists, and categories come from the shared catalog context,
// which loads live backend data (with retry and cached-data fallback).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
} from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ServiceCard from '../components/ServiceCard';
import SpecialistCard from '../components/SpecialistCard';
import { useDemo } from '../store/DemoContext';

const whyPoints = [
  {
    icon: Timer,
    title: 'Save time',
    text: 'Book in under a minute. No queues, no phone calls — pick a slot that fits your day.',
  },
  {
    icon: ShieldCheck,
    title: 'Trusted specialists',
    text: 'Every provider is experienced and rated by real customers.',
  },
  {
    icon: Scissors,
    title: 'Clear NPR pricing',
    text: 'See the price and duration upfront in NPR. No surprises at the counter.',
  },
  {
    icon: CalendarCheck,
    title: 'Easy cancellation',
    text: 'Cancel upcoming appointments more than 24 hours ahead from your dashboard.',
  },
];

const steps = [
  { icon: Scissors, title: 'Choose a service', text: 'Browse the catalog and compare price, duration, and what is included.' },
  { icon: Users, title: 'Pick a specialist', text: 'See who provides the service and choose the professional you prefer.' },
  { icon: CalendarCheck, title: 'Reserve your slot', text: 'Pick a date and time from live availability, then confirm in seconds.' },
];

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-10 w-full" />
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const demo = useDemo();
  const services = Array.isArray(demo.services) ? demo.services : [];
  const categories = Array.isArray(demo.categories) ? demo.categories : [];
  const specialists = Array.isArray(demo.specialists) ? demo.specialists : [];

  const uniqServices = [...new Map(services.map((s) => [s.id, s])).values()];
  const uniqSpecialists = [...new Map(specialists.map((s) => [s.id, s])).values()];
  const featuredServices = uniqServices.slice(0, 4);
  const featuredSpecialists = uniqSpecialists.slice(0, 4);
  const popularCategories = categories.filter((category) => category.id !== 'all').slice(0, 4);
  const loading = demo.catalogLoading && services.length === 0;

  const submitSearch = (event) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/services?q=${encodeURIComponent(term)}` : '/services');
  };

  return (
    <div>
      {demo.catalogError ? (
        <div className="container-page pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>Could not refresh live service data. {demo.catalogError}</span>
            <button type="button" onClick={demo.refreshCatalog} className="font-semibold underline">
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* ----- Hero ----- */}
      <section className="hero-surface">
        <div className="container-page grid items-center gap-12 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-teal-deep shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Trusted specialists, booked in minutes
            </span>

            <h1 className="text-display mt-6">
              Scheduling that feels <span className="text-teal-deep">effortless.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Discover professional services, compare specialists, and reserve a time
              that works for you — for clinics, salons, consultancies, and training
              businesses.
            </p>

            <form onSubmit={submitSearch} className="mt-7 max-w-xl" role="search">
              <label htmlFor="home-search" className="sr-only">
                Search services
              </label>
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-soft sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="home-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a service, e.g. dental check-up"
                    className="w-full rounded-xl border-0 bg-transparent py-2.5 pr-3 pl-10 text-sm text-ink outline-none placeholder:text-slate-400"
                  />
                </div>
                <Button type="submit" size="md" className="sm:w-auto">
                  Search
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap gap-2">
              {['Dental', 'Haircut', 'Consulting', 'Training'].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigate(`/services?q=${encodeURIComponent(term)}`)}
                  className="chip px-3 py-1.5 text-xs"
                >
                  {term}
                </button>
              ))}
            </div>

            <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {[
                { label: 'Services', value: services.length || '—' },
                { label: 'Specialists', value: specialists.length || '—' },
                { label: 'Categories', value: Math.max(0, categories.length - 1) || '—' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/80 bg-white/75 px-3.5 py-3 shadow-sm backdrop-blur">
                  <p className="font-display text-xl font-bold tracking-tight text-teal-deep sm:text-2xl">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-md lg:block">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-teal-200/45 via-transparent to-amber-100/45 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80&auto=format&fit=crop"
                alt="A professional preparing for an appointment"
                className="h-[440px] w-full rounded-[2rem] border border-white/70 object-cover shadow-[0_30px_80px_-40px_rgba(11,27,43,0.5)]"
              />
              <div className="absolute -bottom-5 right-4 left-4 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-pop backdrop-blur">
                <div className="flex items-start gap-3">
                  <span className="icon-tile-brand h-10 w-10">
                    <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">Simple booking flow</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                      Choose a service, pick a specialist, and reserve a live time slot.
                    </p>
                  </div>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                    4.8
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----- Trust strip ----- */}
      <section className="border-b border-line/70 bg-white/70">
        <div className="container-page grid gap-3 py-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, text: 'Verified specialists' },
            { icon: Clock3, text: 'Live availability' },
            { icon: CheckCircle2, text: 'No payment required to book' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
              <Icon className="h-4 w-4 text-teal-deep" aria-hidden="true" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ----- Categories ----- */}
      <section className="section">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Browse by category</span>
              <h2 className="text-h2 mt-2">Find your service faster</h2>
            </div>
            <Button to="/services" variant="ghost" size="sm">
              View all services
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popularCategories.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-ink-soft sm:col-span-2 lg:col-span-4">
                {loading ? 'Loading categories…' : 'No categories are available yet.'}
              </p>
            ) : (
              popularCategories.map((category, index) => {
                const count = services.filter((service) => service.category === category.id).length;
                return (
                  <Link
                    key={category.id}
                    to={`/services?category=${encodeURIComponent(category.id)}`}
                    className="group flex items-start gap-3 rounded-2xl border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-teal-100 hover:shadow-lift"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
                      <Scissors className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-ink group-hover:text-teal-deep">
                        {category.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {count} {count === 1 ? 'service' : 'services'}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-deep">
                        Explore
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="ml-auto text-[11px] font-bold text-slate-300">{String(index + 1).padStart(2, '0')}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ----- Featured services ----- */}
      <section className="border-y border-line/70 bg-white">
        <div className="container-page section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Featured</span>
              <h2 className="text-h2 mt-2">Popular services</h2>
              <p className="text-muted mt-2">Most-loved services, recommended by customers.</p>
            </div>
            <Button to="/services" variant="secondary" size="sm">
              Browse all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            ) : featuredServices.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <EmptyState
                  title={demo.catalogError ? 'Services could not be loaded' : 'No services available yet'}
                  description={
                    demo.catalogError
                      ? 'The catalog API did not respond. Try again in a moment.'
                      : 'The service catalog is empty right now. Check back soon.'
                  }
                  icon={Scissors}
                >
                  {demo.catalogError ? (
                    <Button onClick={demo.refreshCatalog} variant="secondary">
                      Try again
                    </Button>
                  ) : null}
                </EmptyState>
              </div>
            ) : (
              featuredServices.map((service) => <ServiceCard key={service.id} service={service} />)
            )}
          </div>
        </div>
      </section>

      {/* ----- How it works ----- */}
      <section className="section">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="text-h2 mt-2">Three steps to your appointment</h2>
            <p className="text-muted mt-2">No phone calls, no waiting. Just a clear, quick flow.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                  <span className="absolute top-5 right-5 font-display text-3xl font-extrabold text-slate-100">
                    {index + 1}
                  </span>
                  <span className="icon-tile">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----- Featured specialists ----- */}
      <section className="border-y border-line/70 bg-white">
        <div className="container-page section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">The team</span>
              <h2 className="text-h2 mt-2">Meet our specialists</h2>
              <p className="text-muted mt-2">Experienced professionals who care about quality.</p>
            </div>
            <Button to="/specialists" variant="secondary" size="sm">
              View all specialists
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            ) : featuredSpecialists.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <EmptyState
                  title="No specialists available yet"
                  description="Specialist profiles will appear here once they are added."
                  icon={Users}
                />
              </div>
            ) : (
              featuredSpecialists.map((specialist) => {
                const names = (Array.isArray(specialist.serviceIds) ? specialist.serviceIds : [])
                  .map((sid) => services.find((service) => service.id === sid)?.name)
                  .filter(Boolean);
                return <SpecialistCard key={specialist.id} specialist={specialist} serviceNames={names} />;
              })
            )}
          </div>
        </div>
      </section>

      {/* ----- Why choose us ----- */}
      <section className="section">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Why BookEase</span>
            <h2 className="text-h2 mt-2">Built to make booking effortless</h2>
            <p className="text-muted mt-2">Everything you need to plan your visit with confidence.</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {whyPoints.map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                  <span className="icon-tile">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-ink">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{point.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----- Final CTA ----- */}
      <section className="container-page pb-16 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-teal-deep px-6 py-12 text-center shadow-pop sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(420px 220px at 15% 0%, rgba(45,212,191,0.35), transparent 60%), radial-gradient(420px 240px at 90% 100%, rgba(255,255,255,0.12), transparent 60%)',
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Ready to book your appointment?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-teal-50/90 sm:text-base">
              Choose a service, pick your specialist, and reserve your slot in under a minute.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button to="/booking" size="lg" variant="light">
                Book appointment
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button to="/services" size="lg" variant="onDark">
                Explore services
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
