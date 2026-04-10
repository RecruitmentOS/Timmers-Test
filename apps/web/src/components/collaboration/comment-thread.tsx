"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MentionChip } from "./mention-chip";
import { CommentInput } from "./comment-input";
import {
  useComments,
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/use-comments";
import { useOrgUsers } from "@/hooks/use-activity";
import { Lock, Pencil, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";
import { nl, enUS } from "date-fns/locale";
import type { Comment, CommentTargetType } from "@recruitment-os/types";

/**
 * CommentThread — renders list of comments with author avatars, timestamps,
 * and @mention highlights. Own comments show edit/delete actions on hover.
 *
 * Per UI-SPEC: 32px avatar, font-semibold text-sm author, relative timestamp,
 * inline MentionChip highlights in body. Internal comments show outline badge with lock.
 */
export function CommentThread({
  targetType,
  targetId,
  includeInternal = true,
}: {
  targetType: CommentTargetType;
  targetId: string;
  includeInternal?: boolean;
}) {
  const t = useTranslations("comments");
  const { data: comments, isLoading } = useComments(
    targetType,
    targetId,
    includeInternal
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(!comments || comments.length === 0) && (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <h4 className="text-sm font-semibold text-muted-foreground">
            {t("empty")}
          </h4>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
      )}

      {comments?.map((comment) => (
        <CommentItem key={comment.id} comment={comment} targetType={targetType} targetId={targetId} />
      ))}

      <CommentInput targetType={targetType} targetId={targetId} />
    </div>
  );
}

function CommentItem({
  comment,
  targetType,
  targetId,
}: {
  comment: Comment;
  targetType: CommentTargetType;
  targetId: string;
}) {
  const t = useTranslations("comments");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(comment.body);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const { data: orgUsers } = useOrgUsers();

  // Build a map of user IDs to names for mention rendering
  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    orgUsers?.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [orgUsers]);

  const handleSaveEdit = async () => {
    await updateComment.mutateAsync({
      id: comment.id,
      patch: { body: editBody },
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteComment.mutateAsync({
      id: comment.id,
      targetType,
      targetId,
    });
    setDeleteOpen(false);
  };

  // Render body with inline @mention chips
  const renderBody = (body: string, mentions: string[]) => {
    if (!mentions || mentions.length === 0) {
      return <p className="text-sm">{body}</p>;
    }

    // Simple approach: scan for @Name patterns and replace with chips
    const parts: React.ReactNode[] = [];
    let remaining = body;
    let key = 0;

    for (const userId of mentions) {
      const name = userMap.get(userId);
      if (!name) continue;
      const pattern = `@${name}`;
      const idx = remaining.indexOf(pattern);
      if (idx >= 0) {
        if (idx > 0) {
          parts.push(
            <span key={key++}>{remaining.slice(0, idx)}</span>
          );
        }
        parts.push(<MentionChip key={key++} name={name} />);
        remaining = remaining.slice(idx + pattern.length);
      }
    }
    if (remaining) {
      parts.push(<span key={key++}>{remaining}</span>);
    }

    return <p className="text-sm">{parts.length > 0 ? parts : body}</p>;
  };

  const initials = comment.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group flex gap-3">
      <Avatar>
        {comment.authorAvatar && (
          <AvatarImage src={comment.authorAvatar} alt={comment.authorName} />
        )}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
              locale: getDateLocale(),
            })}
          </span>
          {comment.isInternal && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" />
              {t("internal")}
            </Badge>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateComment.isPending}
              >
                {t("editSave")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditBody(comment.body);
                }}
              >
                {t("editCancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            {renderBody(comment.body, comment.mentions)}
          </div>
        )}

        {/* Edit/delete actions on hover — own comments only */}
        {!isEditing && (
          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsEditing(true)}
              title={t("edit")}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDeleteOpen(true)}
              title={t("delete")}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("editCancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteComment.isPending}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
