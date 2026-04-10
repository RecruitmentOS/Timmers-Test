"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";
import type { Notification, NotificationKind } from "@recruitment-os/types";

/**
 * NotificationDropdown — last 20 notifications in a floating panel.
 * Per D-07: each item has actor avatar + description + timestamp.
 * Click marks as read and navigates to target.
 * "Alles als gelezen markeren" button at top.
 */

function getNotificationKey(kind: NotificationKind): string {
  switch (kind) {
    case "mention":
      return "notifications.mention";
    case "assignment":
      return "notifications.assignment";
    case "hm_feedback":
      return "notifications.hmFeedback";
    case "hm_request":
      return "notifications.hmRequest";
    default:
      return "notifications.mention";
  }
}

export function NotificationDropdown({
  onClose,
}: {
  onClose: () => void;
}) {
  const t = useTranslations();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleClick = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
    // Navigation to target — for now close the dropdown
    onClose();
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg"
    >
      <div className="flex items-center justify-between p-3">
        <h3 className="text-sm font-semibold">
          {t("notifications.title")}
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending}
        >
          {t("notifications.markAllRead")}
        </Button>
      </div>
      <Separator />
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={`flex w-full items-start gap-3 p-3 text-left hover:bg-accent ${
                !n.readAt ? "bg-accent/50" : ""
              }`}
            >
              <Avatar size="sm">
                <AvatarFallback>
                  {n.actorName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  {t(getNotificationKey(n.kind), {
                    actor: n.actorName,
                  })}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), {
                    addSuffix: true,
                    locale: getDateLocale(),
                  })}
                </span>
              </div>
              {!n.readAt && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
