"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket-client";

/**
 * Subscribe to realtime pipeline updates for a specific vacancy.
 *
 * When another user moves a candidate or performs a bulk action,
 * the server broadcasts `pipeline:update` to the vacancy's tenant room.
 * This hook invalidates the TanStack Query cache so the board refetches.
 *
 * Works alongside useMoveStage optimistic updates: local user sees
 * the move instantly, and the background refetch merges truth from the server.
 */
export function usePipelineSync(vacancyId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("join:vacancy", vacancyId);

    const handler = (event: { vacancyId?: string }) => {
      if (event.vacancyId === vacancyId || !event.vacancyId) {
        qc.invalidateQueries({ queryKey: ["pipeline", vacancyId] });
      }
    };

    socket.on("pipeline:update", handler);

    return () => {
      socket.emit("leave:vacancy", vacancyId);
      socket.off("pipeline:update", handler);
    };
  }, [vacancyId, qc]);
}

/**
 * Subscribe to realtime notifications for the current user.
 *
 * When the server emits `notification:new`, this hook invalidates
 * the notifications query cache so the bell icon updates.
 */
export function useNotificationSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    const handler = () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("notification:new", handler);

    return () => {
      socket.off("notification:new", handler);
    };
  }, [qc]);
}

/**
 * Room timeline sync — invalidates room-timeline query
 * when pipeline events or new comments arrive for this vacancy.
 */
export function useRoomTimelineSync(vacancyId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    const handlePipelineUpdate = () => {
      qc.invalidateQueries({ queryKey: ["room-timeline", vacancyId] });
      qc.invalidateQueries({ queryKey: ["room-stats", vacancyId] });
    };

    socket.on("pipeline:update", handlePipelineUpdate);
    return () => {
      socket.off("pipeline:update", handlePipelineUpdate);
    };
  }, [vacancyId, qc]);
}
