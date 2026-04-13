"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSocket } from "@/lib/socket-client";

/** 8-color palette for cursor dots — hashed from userId */
const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

function hashColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export interface RemoteCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  cardId?: string;
  color: string;
  lastSeen: number;
}

/**
 * Live cursor tracking for the pipeline board.
 *
 * - Emits cursor:move throttled to max 20/sec (50ms)
 * - Listens for cursor:update / cursor:remove from other users
 * - Returns cursors map and a containerRef for relative positioning
 */
export function useLiveCursors(vacancyId: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const lastEmitRef = useRef(0);

  // Emit throttled cursor:move
  const emitMove = useCallback(
    (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastEmitRef.current < 50) return; // 20 events/sec max
      lastEmitRef.current = now;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const socket = getSocket();
      if (socket.connected) {
        socket.emit("cursor:move", { vacancyId, x, y });
      }
    },
    [vacancyId]
  );

  // Listen for remote cursor events
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    const handleUpdate = (data: {
      userId: string;
      userName: string;
      x: number;
      y: number;
      cardId?: string;
    }) => {
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          ...data,
          color: hashColor(data.userId),
          lastSeen: Date.now(),
        });
        return next;
      });
    };

    const handleRemove = (data: { userId: string }) => {
      setCursors((prev) => {
        if (!prev.has(data.userId)) return prev;
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("cursor:update", handleUpdate);
    socket.on("cursor:remove", handleRemove);

    return () => {
      socket.off("cursor:update", handleUpdate);
      socket.off("cursor:remove", handleRemove);
      // Emit leave when unmounting or vacancy changes
      if (socket.connected) {
        socket.emit("cursor:leave", { vacancyId });
      }
    };
  }, [vacancyId]);

  // Fade out stale cursors (no movement for 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, cursor] of next) {
          if (now - cursor.lastSeen > 5000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { cursors, containerRef, emitMove };
}
