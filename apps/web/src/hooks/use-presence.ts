"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";

export interface Viewer {
  userId: string;
  userName: string;
}

/**
 * Track which users are currently viewing a specific vacancy pipeline.
 *
 * Listens for `presence:join` and `presence:leave` events in the
 * vacancy room and returns a deduplicated list of viewers.
 */
export function usePresence(vacancyId: string) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  const addViewer = useCallback((v: Viewer) => {
    setViewers((prev) => {
      if (prev.some((p) => p.userId === v.userId)) return prev;
      return [...prev, v];
    });
  }, []);

  const removeViewer = useCallback((v: Viewer) => {
    setViewers((prev) => prev.filter((p) => p.userId !== v.userId));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.on("presence:join", addViewer);
    socket.on("presence:leave", removeViewer);

    return () => {
      socket.off("presence:join", addViewer);
      socket.off("presence:leave", removeViewer);
    };
  }, [vacancyId, addViewer, removeViewer]);

  return { viewers };
}
