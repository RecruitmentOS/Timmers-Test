"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ActivityEvent } from "@recruitment-os/types";

/**
 * Activity feed hooks.
 *
 * - useActivity(vacancyId): infinite query with cursor-based pagination
 * - useOrgUsers(): list of org members for @mention picker
 */

type ActivityPage = {
  events: ActivityEvent[];
  nextCursor: string | null;
};

export function useActivity(vacancyId: string) {
  return useInfiniteQuery<ActivityPage>({
    queryKey: ["activity", vacancyId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ vacancyId });
      if (pageParam) params.set("cursor", pageParam as string);
      return apiClient<ActivityPage>(`/api/activity?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!vacancyId,
  });
}

export type OrgUser = {
  id: string;
  name: string;
  image: string | null;
};

export function useOrgUsers() {
  return useQuery<OrgUser[]>({
    queryKey: ["org-users"],
    queryFn: () => apiClient<OrgUser[]>("/api/activity/users"),
    staleTime: 60_000,
  });
}
