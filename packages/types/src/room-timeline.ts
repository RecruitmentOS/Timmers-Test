/**
 * Unified timeline item for Vacancy Rooms.
 * Merges comments and activity events into one stream.
 */
export type RoomTimelineItemKind = "comment" | "event";

export interface RoomTimelineComment {
  kind: "comment";
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  mentions: string[];
  commentKind: "comment" | "hm_feedback";
  feedbackThumb: "up" | "down" | null;
  isInternal: boolean;
  createdAt: string;
}

export interface RoomTimelineEvent {
  kind: "event";
  id: string;
  eventType: string;
  actorId: string;
  actorName: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export type RoomTimelineItem = RoomTimelineComment | RoomTimelineEvent;

export interface RoomTimelinePage {
  items: RoomTimelineItem[];
  nextCursor: string | null;
}

export interface RoomStats {
  total: number;
  qualified: number;
  interview: number;
  overdue: number;
}
