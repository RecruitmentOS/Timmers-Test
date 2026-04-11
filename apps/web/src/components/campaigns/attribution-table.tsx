"use client";

import { useState } from "react";
import Link from "next/link";
import { useCampaignApplications } from "@/hooks/use-campaigns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  screening: "bg-purple-100 text-purple-800",
  interview: "bg-indigo-100 text-indigo-800",
  offer: "bg-orange-100 text-orange-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const QUAL_COLORS: Record<string, string> = {
  yes: "bg-green-100 text-green-800",
  maybe: "bg-yellow-100 text-yellow-800",
  no: "bg-red-100 text-red-800",
  pending: "bg-gray-100 text-gray-800",
};

const PAGE_SIZE = 10;

interface AttributionTableProps {
  campaignId: string;
}

export function AttributionTable({ campaignId }: AttributionTableProps) {
  const { data: applications, isLoading } =
    useCampaignApplications(campaignId);
  const [page, setPage] = useState(0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const items = (applications as any[]) ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Geen sollicitaties gekoppeld aan deze campagne
      </p>
    );
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kandidaat</TableHead>
            <TableHead>Vacature</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Kwalificatie</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((app: any) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/candidates/${app.candidateId}`}
                  className="hover:underline"
                >
                  {app.candidateFirstName ?? ""}{" "}
                  {app.candidateLastName ?? ""}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {app.vacancyTitle ?? "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    STAGE_COLORS[app.currentStage ?? ""] ?? ""
                  }
                >
                  {app.currentStage ?? "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    QUAL_COLORS[app.qualificationStatus ?? "pending"] ?? ""
                  }
                >
                  {app.qualificationStatus ?? "pending"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {app.createdAt
                  ? new Date(app.createdAt).toLocaleDateString("nl-NL")
                  : "-"}
              </TableCell>
              <TableCell>
                <Link
                  href={`/candidates/${app.candidateId}`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Bekijk kandidaat
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            Pagina {page + 1} van {totalPages} ({items.length} resultaten)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Vorige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Volgende
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
