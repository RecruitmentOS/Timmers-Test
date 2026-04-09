"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Notification } from "@recruitment-os/types";

/**
 * Notification query + mutation hooks.
 *
 * - useNotifications(): last 20 notifications for current user
 * - useUnreadCount(): badge count with 30s stale time
 * - useMarkRead(): mark single notification read
 * - useMarkAllRead(): mark all notifications read
 */

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiClient<Notification[]>("/api/notifications"),
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      apiClient<{ count: number }>("/api/notifications/unread-count"),
    staleTime: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiClient<{ ok: true }>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, void>({
    mutationFn: () =>
      apiClient<{ ok: true }>("/api/notifications/mark-all-read", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}
