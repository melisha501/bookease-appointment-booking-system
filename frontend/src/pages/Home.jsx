// Home — landing page for the public website.
// Exact project description and NPR pricing per brief. Data comes from the
// demo store (clone of mockData) so Admin edits appear here automatically.

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Scissors,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';

import Button from '../components/Button';
import Card from '../components/Card';
import ServiceCard from '../components/ServiceCard';
import SpecialistCard from '../components/SpecialistCard';
import { useDemo } from '../store/DemoContext';

export default function Home() {
  // Data comes from the demo context (local data, not an API).
  // Use Array.isArray defaults so a missing array can never crash
  // .map()/.filter() rendering (blank page). Empty arrays still render
  // their sections safely with no items.
  const demo = useDemo();
  const services = Array.isArray(demo.services) ? demo.services : [];
  const categories = Array.isArray(demo.categories) ? demo.categories : [];
  const specialists = Array.isArray(demo.specialists) ? demo.specialists : [];

  // De-duplicated featured lists (first 4 unique by id).
  const featuredServices = [...new Map(services.map((s) => [s.id, s])).values()].slice(0, 4);
  const featuredSpecialists = [...new Map(specialists.map((s) => [s.id, s])).values()].slice(0, 4);
  const popularCategories = categories.filter((category) => category.id !== 'all');

  // Popular services — top services by rating.
  const popularServices = [...services].sort((a, b) => b.rating - a.rating).slice(0, 6);

  const whyPoints = [
    {
      icon: Timer,
      title: 'Save Time',
      text: 'Book in under a minute. No queues, no phone calls — pick a slot that fits your day.',
    },
    {
      icon: ShieldCheck,
      title: 'Trusted Specialists',
      text: 'Every provider is experienced and rated by real customers.',
    },
    {
      icon: Scissors,
      title: 'Clear NPR Pricing',
      text: 'See the price and duration upfront in NPR. No surprises at the counter.',
    },
    {
      icon: CalendarCheck,
      title: 'Easy Cancellation',
      text: 'Cancel upcoming appointments more than 24 hours ahead from your dashboard.',
    },
  ];

  return (
    <div>
      {demo.catalogError ? (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Could not load live service data: {demo.catalogError}{' '}
            <button type="button" onClick={demo.refreshCatalog} className="font-semibold underline">Retry</button>
          </div>
        </div>
      ) : null}

      {/* ----- Hero ----- */}
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(20,184,166,0.16),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(15,118,110,0.12),transparent_28%),linear-gradient(180deg,#ffffff,rgba(246,248,251,0.75))]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-teal-deep shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Book trusted specialists in minutes
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-ink sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
              A premium booking experience for services, specialists, and schedules.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Discover professional services, compare specialists, and reserve appointments with confidence.
              Designed for clinics, salons, consultancies, and training businesses.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/booking" size="lg">
                Book Appointment
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button to="/services" size="lg" variant="secondary">
                Explore Services
              </Button>
              <Button to="/specialists" size="lg" variant="soft">
                Meet Specialists
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Services available', value: services.length || '—' },
                { label: 'Specialists', value: specialists.length || '—' },
                { label: 'Categories', value: popularCategories.length || '—' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-4 shadow-sm backdrop-blur">
                  <p className="text-2xl font-bold tracking-tight text-teal-deep">{stat.value}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-teal-200/40 via-transparent to-amber-100/40 blur-2xl" />
            <div className="relative animate-float-slow">
              <img
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=80&auto=format&fit=crop"
                alt="Professional appointment and wellness service"
                className="h-[460px] w-full rounded-[2rem] border border-white/70 object-cover shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]"
              />
              <div className="absolute -bottom-5 left-6 right-6 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-deep">
                    <CalendarCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Simple booking flow</p>
                    <p className="mt-0.5 text-sm text-ink-soft">Choose a service, pick a specialist, and reserve a time slot with live availability.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----- Popular categories ----- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Popular Categories</h2>
            <p className="mt-2 text-ink-soft">Clinics, salons, consultancy and training — find your service.</p>
          </div>
          <Button to="/services" variant="ghost">
            View all services <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularCategories.map((category) => (
            <Link
              key={category.id}
              to="/services"
              className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-lg font-bold text-teal-deep">
                {category.name[0]}
              </span>
              <h3 className="mt-4 text-base font-bold text-ink">{category.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">
                {services.filter((service) => service.category === category.id).length} services available
              </p>
            </Link>
          ))}
        </div>

        {/* Popular services (text list with links) */}
        <div className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-ink">Popular Services</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {popularServices.map((service) => (
              <Link
                key={service.id}
                to={`/services/${service.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface"
              >
                <span className="font-medium text-ink">{service.name}</span>
                <span className="font-bold whitespace-nowrap text-teal-deep">{service.price}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ----- Featured services ----- */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Featured Services</h2>
              <p className="mt-2 text-ink-soft">Most loved services, recommended by customers.</p>
            </div>
            <Button to="/services" variant="ghost">
              Browse all <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {featuredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* ----- Featured specialists ----- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Featured Specialists</h2>
            <p className="mt-2 text-ink-soft">Experienced professionals who care about quality.</p>
          </div>
          <Button to="/specialists" variant="ghost">
            Meet all specialists <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {featuredSpecialists.map((specialist) => {
            const names = (Array.isArray(specialist.serviceIds) ? specialist.serviceIds : [])
              .map((sid) => services.find((s) => s.id === sid)?.name)
              .filter(Boolean);
            return <SpecialistCard key={specialist.id} specialist={specialist} serviceNames={names} />;
          })}
        </div>
      </section>

      {/* ----- Why Choose Us ----- */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Why Choose Us</h2>
            <p className="mt-2 text-ink-soft">Built to make booking effortless and reliable.</p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyPoints.map((point) => {
              const Icon = point.icon;
              return (
                <Card key={point.title} className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-deep">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-ink">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{point.text}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials are shown only when real review data is available from the backend. */}

      {/* ----- Final CTA ----- */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-teal-deep px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ready to book your appointment?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-teal-100 sm:text-base">
            Choose a service, pick your specialist and reserve your slot in under a minute.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/booking" size="lg" className="bg-white text-teal-deep hover:bg-teal-50">
              Book Appointment
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button to="/services" size="lg" variant="secondary">
              Explore Services
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
