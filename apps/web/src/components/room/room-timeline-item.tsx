// apps/web/src/components/room/room-timeline-item.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MentionChip } from "@/components/collaboration/mention-chip";
import {
  Lock,
  ArrowRight,
  CheckCircle2,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
  MessageSquareReply,
  XCircle,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";
import type {
  RoomTimelineItem as TimelineItem,
  RoomTimelineComment,
  RoomTimelineEvent,
} from "@recruitment-os/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CommentItem({ item }: { item: RoomTimelineComment }) {
  return (
    <div className="flex gap-3">
      <Avatar>
        {item.authorAvatar && (
          <AvatarImage src={item.authorAvatar} alt={item.authorName} />
        )}
        <AvatarFallback>{initials(item.authorName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{item.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
              locale: getDateLocale(),
            })}
          </span>
          {item.isInternal && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Lock className="size-3" />
              Intern
            </Badge>
          )}
          {item.commentKind === "hm_feedback" && item.feedbackThumb && (
            <Badge
              variant={item.feedbackThumb === "up" ? "default" : "destructive"}
              className="gap-1 text-xs"
            >
              {item.feedbackThumb === "up" ? (
                <ThumbsUp className="size-3" />
              ) : (
                <ThumbsDown className="size-3" />
              )}
              Feedback
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{item.body}</p>
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stage_changed: ArrowRight,
  qualified: CheckCircle2,
  assigned: UserPlus,
  intake_started: MessageSquareReply,
  intake_qualified: CheckCircle2,
  intake_rejected: XCircle,
  intake_unsure: HelpCircle,
  intake_escalated: AlertTriangle,
};

const EVENT_LABELS: Record<string, (meta: Record<string, unknown>) => string> = {
  stage_changed: (meta) =>
    `verplaatst naar ${(meta.toStageName as string) ?? "volgende fase"}`,
  qualified: (meta) =>
    `gemarkeerd als ${(meta.status as string) ?? "beoordeeld"}`,
  assigned: () => "toegewezen",
  task_created: () => "taak aangemaakt",
  task_completed: () => "taak afgerond",
  sent_to_client: () => "voorgesteld aan klant",
  sent_to_hiring_manager: () => "doorgestuurd naar hiring manager",
  hm_feedback: (meta) =>
    `feedback: ${(meta.feedbackThumb as string) === "up" ? "positief" : "negatief"}`,
  hm_request: () => "verzoek om meer kandidaten",
  created: () => "aangemaakt",
  intake_started: () => "intake gestart via WhatsApp",
  intake_qualified: () => "gekwalificeerd door bot",
  intake_rejected: () => "afgewezen door bot",
  intake_unsure: () => "bot twijfelt — wacht op recruiter",
  intake_escalated: (meta) => `bot escaleerde (${(meta.reason as string) ?? "onbekend"})`,
};

function EventItem({ item }: { item: RoomTimelineEvent }) {
  const Icon = EVENT_ICONS[item.eventType] ?? ArrowRight;
  const labelFn = EVENT_LABELS[item.eventType];
  const label = labelFn ? labelFn(item.meta) : item.eventType;
  const candidateName =
    ((item.meta.candidateFirstName as string) ?? "") +
    " " +
    ((item.meta.candidateLastName as string) ?? "");
  const showCandidate = candidateName.trim().length > 0;

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>
        <span className="font-medium text-foreground">{item.actorName}</span>
        {" "}
        {label}
        {showCandidate && (
          <>
            {" — "}
            <span className="font-medium text-foreground">
              {candidateName.trim()}
            </span>
          </>
        )}
      </span>
      <span className="ml-auto shrink-0">
        {formatDistanceToNow(new Date(item.createdAt), {
          addSuffix: true,
          locale: getDateLocale(),
        })}
      </span>
    </div>
  );
}

export function RoomTimelineItem({ item }: { item: TimelineItem }) {
  if (item.kind === "comment") {
    return <CommentItem item={item} />;
  }
  return <EventItem item={item} />;
}
