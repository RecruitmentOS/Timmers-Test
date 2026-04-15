"use client";

import { useClientPlacements } from "@/hooks/use-portal";
import type { PortalPlacement } from "@/hooks/use-portal";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import Link from "next/link";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRate(rate: string | null): string {
  if (!rate) return "-";
  return `EUR ${parseFloat(rate).toFixed(2)}`;
}

function InlenersbeloningBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      Ja
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      Nee
    </span>
  );
}

function PlacementCard({ placement }: { placement: PortalPlacement }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{placement.candidateName}</span>
        <InlenersbeloningBadge value={placement.inlenersbeloning} />
      </div>
      <div className="text-sm text-muted-foreground">
        <Link
          href={`/portal/vacancies/${placement.vacancyId}`}
          className="text-primary hover:underline"
        >
          {placement.vacancyTitle}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Uurtarief:</span>{" "}
          {formatRate(placement.agreedRate)}
        </div>
        <div>
          <span className="font-medium text-foreground">Startdatum:</span>{" "}
          {formatDate(placement.startDate)}
        </div>
        <div>
          <span className="font-medium text-foreground">Geplaatst:</span>{" "}
          {formatDate(placement.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function ClientPlacementsPage() {
  const { data: placements, isLoading, error } = useClientPlacements();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plaatsingen</h1>
        <p className="text-muted-foreground mt-1">
          Overzicht van geplaatste kandidaten en afgesproken tarieven
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Kon plaatsingen niet laden. Probeer het opnieuw.
        </p>
      ) : placements && placements.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Kandidaat</th>
                  <th className="px-4 py-3 text-left font-medium">Vacature</th>
                  <th className="px-4 py-3 text-left font-medium">Uurtarief</th>
                  <th className="px-4 py-3 text-left font-medium">Inlenersbeloning</th>
                  <th className="px-4 py-3 text-left font-medium">Startdatum</th>
                  <th className="px-4 py-3 text-left font-medium">Datum plaatsing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {placements.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.candidateName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/portal/vacancies/${p.vacancyId}`}
                        className="text-primary hover:underline"
                      >
                        {p.vacancyTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatRate(p.agreedRate)}</td>
                    <td className="px-4 py-3">
                      <InlenersbeloningBadge value={p.inlenersbeloning} />
                    </td>
                    <td className="px-4 py-3">{formatDate(p.startDate)}</td>
                    <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {placements.map((p) => (
              <PlacementCard key={p.id} placement={p} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FileText className="size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Geen plaatsingen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Er zijn nog geen kandidaten geplaatst.
          </p>
        </div>
      )}
    </div>
  );
}
