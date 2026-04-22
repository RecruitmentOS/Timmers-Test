// apps/web/src/components/room/room-timeline.tsx
"use client";

import * as React from "react";
import { useRoomTimeline } from "@/hooks/use-room-timeline";
import { RoomTimelineItem } from "./room-timeline-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function RoomTimeline({
  vacancyId,
  includeInternal = true,
}: {
  vacancyId: string;
  includeInternal?: boolean;
}) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRoomTimeline(vacancyId, includeInternal);

  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on initial load and new items
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.pages?.[0]?.items?.length]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flatten pages and reverse to show oldest-first (API returns DESC)
  const allItems = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items).reverse();
  }, [data]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Load older */}
      {hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : null}
            Oudere berichten laden
          </Button>
        </div>
      )}

      {/* Timeline items */}
      <div className="flex-1 space-y-3 p-4">
        {allItems.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nog geen activiteit in deze room.
          </p>
        )}
        {allItems.map((item) => (
          <RoomTimelineItem key={item.id} item={item} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
