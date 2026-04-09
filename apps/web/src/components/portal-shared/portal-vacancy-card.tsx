"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users } from "lucide-react";
import { StageCounts } from "./stage-counts";

type Props = {
  vacancy: {
    id: string;
    title: string;
    location: string | null;
    candidateCount: number;
    stageCounts: { name: string; count: number }[];
  };
  /** Base path for linking to vacancy detail, e.g. "/portal/vacancies" */
  basePath: string;
};

export function PortalVacancyCard({ vacancy, basePath }: Props) {
  return (
    <Link href={`${basePath}/${vacancy.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {vacancy.title}
          </CardTitle>
          {vacancy.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {vacancy.location}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <StageCounts stages={vacancy.stageCounts} />
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <Badge variant="secondary" className="text-xs">
              {vacancy.candidateCount} kandidaten
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
