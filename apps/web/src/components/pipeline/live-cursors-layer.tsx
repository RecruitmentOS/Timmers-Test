"use client";

import type { RemoteCursor } from "@/hooks/use-live-cursors";

type Props = {
  cursors: Map<string, RemoteCursor>;
};

/**
 * Visual overlay for live cursors on the pipeline board.
 *
 * Renders colored dots (12px) with user name labels.
 * Smooth movement via CSS transition. Dots fade after 3s of no movement.
 */
export function LiveCursorsLayer({ cursors }: Props) {
  if (cursors.size === 0) return null;

  const now = Date.now();

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 40 }}
      aria-hidden="true"
    >
      {Array.from(cursors.values()).map((cursor) => {
        const idle = now - cursor.lastSeen > 3000;
        return (
          <div
            key={cursor.userId}
            className="absolute"
            style={{
              left: `${cursor.x}%`,
              top: `${cursor.y}%`,
              transition: "left 50ms ease, top 50ms ease, opacity 300ms ease",
              opacity: idle ? 0.3 : 1,
            }}
          >
            {/* Cursor dot */}
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: cursor.color }}
            />
            {/* User name label */}
            <span
              className="absolute left-4 top-0 whitespace-nowrap text-[10px] font-medium px-1 py-0.5 rounded shadow-sm"
              style={{
                backgroundColor: cursor.color,
                color: "white",
              }}
            >
              {cursor.userName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
