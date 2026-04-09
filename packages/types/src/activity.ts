export type ActivityEventType =
  | "stage_changed"
  | "qualified"
  | "comment_added"
  | "task_created"
  | "task_completed"
  | "assigned"
  | "sent_to_client"
  | "sent_to_hiring_manager"
  | "hm_feedback"
  | "hm_request"
  | "bulk_move"
  | "bulk_reject"
  | "bulk_assign";

export interface ActivityEvent {
  id: string;
  eventType: ActivityEventType;
  actorId: string;
  actorName: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown>;
  createdAt: string;
}
