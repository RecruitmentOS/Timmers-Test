"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CalendarConnection } from "@recruitment-os/types";

/**
 * Fetch the user's calendar connections (no tokens exposed).
 */
export function useCalendarConnections() {
  return useQuery<CalendarConnection[]>({
    queryKey: ["calendar-connections"],
    queryFn: () => apiClient("/api/calendar/connections"),
  });
}

/**
 * Fetch which calendar providers are configured server-side.
 */
export function useCalendarProviders() {
  return useQuery<{ google: boolean; outlook: boolean }>({
    queryKey: ["calendar-providers"],
    queryFn: () => apiClient("/api/calendar/providers"),
  });
}

/**
 * Initiate Google Calendar OAuth flow.
 * Opens the auth URL in a new window/tab.
 */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { authUrl } = await apiClient<{ authUrl: string }>(
        "/api/calendar/google/auth"
      );
      window.open(authUrl, "_self");
    },
  });
}

/**
 * Initiate Outlook Calendar OAuth flow.
 * Opens the auth URL in a new window/tab.
 */
export function useConnectOutlook() {
  return useMutation({
    mutationFn: async () => {
      const { authUrl } = await apiClient<{ authUrl: string }>(
        "/api/calendar/outlook/auth"
      );
      window.open(authUrl, "_self");
    },
  });
}

/**
 * Disconnect (delete) a calendar connection.
 */
export function useDisconnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiClient(`/api/calendar/connections/${connectionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
  });
}
