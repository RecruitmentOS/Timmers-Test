// apps/web/src/hooks/use-room-timeline.ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RoomTimelinePage } from "@recruitment-os/types";

export function useRoomTimeline(
  vacancyId: string,
  includeInternal = true
) {
  return useInfiniteQuery<RoomTimelinePage>({
    queryKey: ["room-timeline", vacancyId, includeInternal],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        vacancyId,
        includeInternal: String(includeInternal),
      });
      if (pageParam) params.set("cursor", pageParam as string);
      return apiClient<RoomTimelinePage>(
        `/api/room-timeline?${params.toString()}`
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!vacancyId,
  });
}
