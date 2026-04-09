export type NotificationKind = "mention" | "assignment" | "hm_feedback" | "hm_request";

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  kind: NotificationKind;
  targetType: string;
  targetId: string;
  actorId: string;
  actorName: string;     // joined for display
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
