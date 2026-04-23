"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Trash2, Send, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useComments, useCreateComment, useDeleteComment } from "@/hooks/use-comments";
import { useSession } from "@/lib/auth-client";
import type { Comment } from "@recruitment-os/types";

interface CommentThreadProps {
  targetType: "candidate" | "application" | "vacancy";
  targetId: string;
  className?: string;
}

function renderBody(body: string): React.ReactNode {
  // Highlight @mention tokens blue
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-indigo-600 font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function AuthorAvatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-7 w-7 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: Comment;
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
}) {
  const isOwn = currentUserId === comment.authorId;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
    locale: nl,
  });

  return (
    <div className="flex gap-2.5 group">
      <AuthorAvatar name={comment.authorName} avatar={comment.authorAvatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">
            {comment.authorName}
          </span>
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          {comment.isInternal && (
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Lock className="h-2.5 w-2.5" />
              intern
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {renderBody(comment.body)}
        </div>
      </div>
      {isOwn && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 self-start mt-0.5"
          title="Verwijder reactie"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function CommentThread({ targetType, targetId, className }: CommentThreadProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const { data: comments = [], isLoading } = useComments(targetType, targetId);
  const createMutation = useCreateComment();
  const deleteMutation = useDeleteComment();

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || createMutation.isPending) return;
    await createMutation.mutateAsync({
      targetType,
      targetId,
      body: trimmed,
      mentions: [],
      isInternal: true,
    });
    setBody("");
    textareaRef.current?.focus();
  }, [body, createMutation, targetType, targetId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleDelete(commentId: string) {
    deleteMutation.mutate({ id: commentId, targetType, targetId });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Comment list */}
      <div className="space-y-4">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Laden…</p>
        )}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nog geen notities. Voeg de eerste toe.
          </p>
        )}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDelete}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose area */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <Textarea
          ref={textareaRef}
          placeholder="Notitie toevoegen… gebruik @naam om collega te noemen"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none text-sm min-h-[64px]"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            ⌘ + Enter om te versturen
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!body.trim() || createMutation.isPending}
            className="h-7 px-3 text-xs gap-1.5"
          >
            <Send className="h-3 w-3" />
            Versturen
          </Button>
        </div>
      </div>
    </div>
  );
}
