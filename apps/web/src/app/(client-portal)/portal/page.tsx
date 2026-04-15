"use client";

import { useClientVacancies, useClientPlacements } from "@/hooks/use-portal";
import { PortalDashboard } from "@/components/portal-shared/portal-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function ClientPortalPage() {
  const { data: vacancies, isLoading } = useClientVacancies();
  const { data: placements, isLoading: placementsLoading } = useClientPlacements();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Client Portal</h1>
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
        <h1 className="text-2xl font-semibold">Client Portal</h1>
        <p className="text-muted-foreground mt-1">Uw vacatures en kandidaten</p>
      </div>
      <PortalDashboard
        widgets={[
          {
            title: "Actieve vacatures",
            value: vacancies?.length ?? 0,
            subtitle: "Momenteel open",
          },
          {
            title: "Kandidaten in behandeling",
            value: totalCandidates,
            subtitle: "Wachtend op uw beoordeling",
          },
          {
            title: "Plaatsingen",
            value: placements?.length ?? 0,
            subtitle: "Geplaatste kandidaten",
          },
        ]}
      />
      <Link
        href="/portal/placements"
        className="text-sm text-primary hover:underline"
      >
        Bekijk plaatsingen overzicht
      </Link>
    </div>
  );
}
