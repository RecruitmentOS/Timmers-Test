"use client";

import type { ReactNode } from "react";
import { PortalStatusBadge } from "./portal-status-badge";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";

type Props = {
  candidate: {
    id: string;
    name: string;
    stage: string;
    qualificationStatus: string;
    appliedDate: string;
  };
  actions?: ReactNode;
};

export function PortalCandidateRow({ candidate, actions }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          {candidate.name
            .split(" ")
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="space-y-0.5">
          <p className="font-medium">{candidate.name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PortalStatusBadge status={candidate.stage} />
            <span>
              {formatDistanceToNow(new Date(candidate.appliedDate), {
                addSuffix: true,
                locale: getDateLocale(),
              })}
            </span>
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
