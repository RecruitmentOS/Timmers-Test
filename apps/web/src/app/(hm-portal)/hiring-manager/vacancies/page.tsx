"use client";

import { useHMVacancies } from "@/hooks/use-portal";
import { PortalVacancyCard } from "@/components/portal-shared/portal-vacancy-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";

export default function HMVacanciesPage() {
  const { data: vacancies, isLoading, error } = useHMVacancies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Vacatures</h1>
        <p className="text-muted-foreground mt-1">
          Vacatures van uw team met gedeelde kandidaten
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Kon vacatures niet laden. Probeer het opnieuw.
        </p>
      ) : vacancies && vacancies.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => (
            <PortalVacancyCard
              key={v.id}
              vacancy={v}
              basePath="/hiring-manager/vacancies"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Briefcase className="size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Geen vacatures</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Er zijn momenteel geen vacatures aan u toegewezen.
          </p>
        </div>
      )}
    </div>
  );
}
