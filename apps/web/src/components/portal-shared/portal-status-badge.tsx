"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Nieuw: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "In behandeling":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Goedgekeurd:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Afgewezen:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  yes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  maybe:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  no: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function PortalStatusBadge({ status }: { status: string }) {
  const colorClass =
    STATUS_COLORS[status] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

  return (
    <Badge variant="outline" className={cn("border-0 font-medium", colorClass)}>
      {status}
    </Badge>
  );
}
