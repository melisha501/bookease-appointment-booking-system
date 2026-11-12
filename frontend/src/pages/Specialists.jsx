// Specialists — page listing all specialists from the backend API.

import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import SpecialistCard from '../components/SpecialistCard';
import { useDemo } from '../store/DemoContext';

export default function Specialists() {
  const { specialists, services, catalogLoading, catalogError, refreshCatalog } = useDemo();
  const list = Array.isArray(specialists) ? specialists : [];
  const serviceMap = new Map((Array.isArray(services) ? services : []).map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="page-hero">
        <p className="text-sm font-semibold tracking-wide text-teal-deep uppercase">Trusted professionals</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">Meet our specialists</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Explore profiles, experience, and available services. Open any specialist to view full details and book an appointment.
        </p>
      </div>

      <div className="mt-10">
        {catalogLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[420px] animate-pulse rounded-2xl border border-line bg-white" />
            ))}
          </div>
        ) : catalogError ? (
          <EmptyState title="Could not load specialists" description={catalogError}>
            <Button onClick={refreshCatalog} variant="secondary">Try again</Button>
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState title="No specialists available" description="Please check back later." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((specialist) => (
              <SpecialistCard
                key={specialist.id}
                specialist={specialist}
                serviceNames={(Array.isArray(specialist.serviceIds) ? specialist.serviceIds : [])
                  .map((id) => serviceMap.get(id))
                  .filter(Boolean)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
