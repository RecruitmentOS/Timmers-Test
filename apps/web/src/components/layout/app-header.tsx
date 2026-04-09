"use client";

import { NotificationBell } from "@/components/collaboration/notification-bell";

/**
 * AppHeader — top-right header bar containing the notification bell.
 * Placed above the main content area in the app shell layout.
 */
export function AppHeader() {
  return (
    <header className="flex h-12 items-center justify-end border-b px-4">
      <NotificationBell />
    </header>
  );
}
