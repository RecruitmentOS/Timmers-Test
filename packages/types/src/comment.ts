export type CommentTargetType = "application" | "vacancy" | "candidate";
export type CommentKind = "comment" | "hm_feedback";
export type FeedbackThumb = "up" | "down";

export interface Comment {
  id: string;
  organizationId: string;
  targetType: CommentTargetType;
  targetId: string;
  authorId: string;
  authorName: string;       // joined from user table for display
  authorAvatar?: string;
  body: string;
  mentions: string[];       // user IDs
  kind: CommentKind;
  feedbackThumb?: FeedbackThumb | null;
  isInternal: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateCommentInput {
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  mentions?: string[];
  kind?: CommentKind;
  feedbackThumb?: FeedbackThumb;
  isInternal?: boolean;
}

export interface UpdateCommentInput {
  body: string;
  mentions?: string[];
}
