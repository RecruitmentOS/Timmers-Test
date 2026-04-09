"use client";

import { useHMVacancies } from "@/hooks/use-portal";
import { PortalDashboard } from "@/components/portal-shared/portal-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function HMPortalPage() {
  const { data: vacancies, isLoading } = useHMVacancies();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Hiring Manager Portal</h1>
          <p className="text-muted-foreground mt-1">Uw vacatures en kandidaten</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const totalCandidates =
    vacancies?.reduce((sum, v) => sum + v.candidateCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hiring Manager Portal</h1>
        <p className="text-muted-foreground mt-1">Uw vacatures en kandidaten</p>
      </div>
      <PortalDashboard
        widgets={[
          {
            title: "Toegewezen vacatures",
            value: vacancies?.length ?? 0,
            subtitle: "Aan u toegewezen",
          },
          {
            title: "Kandidaten voor beoordeling",
            value: totalCandidates,
            subtitle: "Wachtend op uw feedback",
          },
        ]}
      />
    </div>
  );
}
