// apps/web/src/hooks/use-room-stats.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RoomStats } from "@recruitment-os/types";

export function useRoomStats(vacancyId: string) {
  return useQuery<RoomStats>({
    queryKey: ["room-stats", vacancyId],
    queryFn: () =>
      apiClient<RoomStats>(
        `/api/room-timeline/stats?vacancyId=${vacancyId}`
      ),
    enabled: !!vacancyId,
    refetchInterval: 30_000, // refresh stats every 30s
  });
}
