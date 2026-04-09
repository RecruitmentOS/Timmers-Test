"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "./activity-item";
import { useActivity } from "@/hooks/use-activity";
import { Activity } from "lucide-react";

/**
 * ActivityTimeline — flat chronological stream per D-08.
 * Uses infinite query with cursor pagination.
 * "Toon oudere activiteiten" button to load more.
 * New items prepended with fade-in (150ms ease-in per UI-SPEC).
 */
export function ActivityTimeline({ vacancyId }: { vacancyId: string }) {
  const t = useTranslations("activity");
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useActivity(vacancyId);

  const allEvents = data?.pages.flatMap((p) => p.events) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="py-8 text-center">
        <Activity className="mx-auto mb-2 size-8 text-muted-foreground/50" />
        <h4 className="text-sm font-semibold text-muted-foreground">
          {t("empty")}
        </h4>
        <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {allEvents.map((event) => (
          <div
            key={event.id}
            className="animate-in fade-in duration-150 ease-in"
          >
            <ActivityItem event={event} />
          </div>
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "..." : t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
