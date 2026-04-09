"use client";

import * as React from "react";
import {
  ArrowRight,
  MessageSquare,
  Check,
  Plus,
  UserCheck,
  Send,
  ThumbsUp,
  HelpCircle,
  Users,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEvent, ActivityEventType } from "@recruitment-os/types";

/**
 * ActivityItem — renders a single timeline entry with icon, actor, verb, and timestamp.
 * Different icons per event type per UI-SPEC.
 */

const EVENT_ICONS: Record<ActivityEventType, React.ElementType> = {
  stage_changed: ArrowRight,
  qualified: Check,
  comment_added: MessageSquare,
  task_created: Plus,
  task_completed: Check,
  assigned: UserCheck,
  sent_to_client: Send,
  sent_to_hiring_manager: Send,
  hm_feedback: ThumbsUp,
  hm_request: HelpCircle,
  bulk_move: Users,
  bulk_reject: XCircle,
  bulk_assign: Users,
};

const EVENT_COLORS: Record<string, string> = {
  stage_changed: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  qualified: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  comment_added: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  task_created: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  task_completed: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  assigned: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  sent_to_client: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  sent_to_hiring_manager: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  hm_feedback: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  hm_request: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  bulk_move: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  bulk_reject: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  bulk_assign: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
};

function getEventDescription(event: ActivityEvent): string {
  const meta = event.meta as Record<string, string>;
  switch (event.eventType) {
    case "stage_changed":
      return `moved to ${meta?.stageName ?? "next stage"}`;
    case "qualified":
      return `qualified as ${meta?.status ?? ""}`;
    case "comment_added":
      return "posted a comment";
    case "task_created":
      return "created a task";
    case "task_completed":
      return "completed a task";
    case "assigned":
      return `assigned to ${meta?.assigneeName ?? "someone"}`;
    case "sent_to_client":
      return "sent to client";
    case "sent_to_hiring_manager":
      return "sent to hiring manager";
    case "hm_feedback":
      return "gave feedback";
    case "hm_request":
      return "requested more candidates";
    case "bulk_move":
      return "bulk moved applications";
    case "bulk_reject":
      return "bulk rejected applications";
    case "bulk_assign":
      return "bulk assigned applications";
    default:
      return event.eventType;
  }
}

export function ActivityItem({ event }: { event: ActivityEvent }) {
  const Icon = EVENT_ICONS[event.eventType] ?? MessageSquare;
  const colorClass = EVENT_COLORS[event.eventType] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${colorClass}`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.actorName}</span>{" "}
          <span className="text-muted-foreground">
            {getEventDescription(event)}
          </span>
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}
