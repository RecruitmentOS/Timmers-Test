"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MentionPicker } from "./mention-picker";
import { MentionChip } from "./mention-chip";
import { useCreateComment } from "@/hooks/use-comments";
import { Lock, Globe } from "lucide-react";
import type { CommentTargetType } from "@recruitment-os/types";

/**
 * CommentInput — textarea with @mention picker and internal/shared toggle.
 *
 * Per UI-SPEC:
 * - Textarea placeholder from i18n t("comments.placeholder")
 * - Typing @ opens MentionPicker popover
 * - Internal/shared toggle: Badge with lock/globe icon
 * - Submit button: t("comments.submit")
 */
export function CommentInput({
  targetType,
  targetId,
  onSubmit,
}: {
  targetType: CommentTargetType;
  targetId: string;
  onSubmit?: () => void;
}) {
  const t = useTranslations("comments");
  const [body, setBody] = React.useState("");
  const [mentions, setMentions] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [isInternal, setIsInternal] = React.useState(true);
  const [mentionPickerOpen, setMentionPickerOpen] = React.useState(false);
  const createComment = useCreateComment();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);

    // Detect @ typed at the end or after a space
    const lastChar = value.slice(-1);
    const prevChar = value.slice(-2, -1);
    if (lastChar === "@" && (!prevChar || prevChar === " " || prevChar === "\n")) {
      setMentionPickerOpen(true);
    }
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    if (!mentions.find((m) => m.id === userId)) {
      setMentions((prev) => [...prev, { id: userId, name: userName }]);
    }
    // Replace the trailing @ with the mention display
    setBody((prev) => {
      const lastAt = prev.lastIndexOf("@");
      return lastAt >= 0
        ? prev.slice(0, lastAt) + `@${userName} `
        : prev + `@${userName} `;
    });
    textareaRef.current?.focus();
  };

  const removeMention = (userId: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    try {
      await createComment.mutateAsync({
        targetType,
        targetId,
        body: body.trim(),
        mentions: mentions.map((m) => m.id),
        isInternal,
      });
      setBody("");
      setMentions([]);
      onSubmit?.();
    } catch {
      // Error is handled by TanStack Query
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder={t("placeholder")}
          value={body}
          onChange={handleBodyChange}
          rows={3}
          className="resize-none"
        />
        <MentionPicker
          open={mentionPickerOpen}
          onOpenChange={setMentionPickerOpen}
          onSelect={handleMentionSelect}
        />
      </div>

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mentions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => removeMention(m.id)}
              className="cursor-pointer"
              title="Remove mention"
            >
              <MentionChip name={m.name} />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className="flex items-center gap-1"
        >
          <Badge variant="outline" className="cursor-pointer gap-1">
            {isInternal ? (
              <>
                <Lock className="size-3" />
                {t("internal")}
              </>
            ) : (
              <>
                <Globe className="size-3" />
                {t("shared")}
              </>
            )}
          </Badge>
        </button>

        <Button
          onClick={handleSubmit}
          disabled={!body.trim() || createComment.isPending}
          size="sm"
        >
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}
