// apps/web/src/components/room/room-message-input.tsx
"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MentionPicker } from "@/components/collaboration/mention-picker";
import { MentionChip } from "@/components/collaboration/mention-chip";
import { useCreateComment } from "@/hooks/use-comments";
import { Lock, Globe, Send } from "lucide-react";

export function RoomMessageInput({ vacancyId }: { vacancyId: string }) {
  const [body, setBody] = React.useState("");
  const [mentions, setMentions] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [isInternal, setIsInternal] = React.useState(true);
  const [mentionPickerOpen, setMentionPickerOpen] = React.useState(false);
  const createComment = useCreateComment();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    const lastChar = value.slice(-1);
    const prevChar = value.slice(-2, -1);
    if (
      lastChar === "@" &&
      (!prevChar || prevChar === " " || prevChar === "\n")
    ) {
      setMentionPickerOpen(true);
    }
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    if (!mentions.find((m) => m.id === userId)) {
      setMentions((prev) => [...prev, { id: userId, name: userName }]);
    }
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
        targetType: "vacancy",
        targetId: vacancyId,
        body: body.trim(),
        mentions: mentions.map((m) => m.id),
        isInternal,
      });
      setBody("");
      setMentions([]);
      // Invalidate room timeline so new comment appears
      qc.invalidateQueries({ queryKey: ["room-timeline", vacancyId] });
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Schrijf een bericht... (Cmd+Enter om te versturen)"
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none pr-12"
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
              title="Verwijder mention"
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
                Intern
              </>
            ) : (
              <>
                <Globe className="size-3" />
                Gedeeld
              </>
            )}
          </Badge>
        </button>

        <Button
          onClick={handleSubmit}
          disabled={!body.trim() || createComment.isPending}
          size="sm"
          className="gap-1"
        >
          <Send className="size-3.5" />
          Verstuur
        </Button>
      </div>
    </div>
  );
}
