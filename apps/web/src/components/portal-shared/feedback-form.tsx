"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useSubmitFeedback } from "@/hooks/use-portal";
import { cn } from "@/lib/utils";

type Props = {
  applicationId: string;
  portalType: "client" | "hm";
  onSubmit?: () => void;
};

/**
 * FeedbackForm — textarea + thumbs up/down toggle for portal feedback.
 */
export function FeedbackForm({ applicationId, portalType, onSubmit }: Props) {
  const [body, setBody] = React.useState("");
  const [thumb, setThumb] = React.useState<"up" | "down" | null>(null);
  const feedback = useSubmitFeedback(portalType);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !thumb) return;
    feedback.mutate(
      { applicationId, body, feedbackThumb: thumb },
      {
        onSuccess: () => {
          setBody("");
          setThumb(null);
          onSubmit?.();
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Schrijf uw feedback..."
        rows={3}
        required
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={thumb === "up" ? "default" : "outline"}
            onClick={() => setThumb("up")}
            className={cn("gap-1.5", thumb === "up" && "bg-green-600 hover:bg-green-700")}
          >
            <ThumbsUp className="size-3.5" />
            Positief
          </Button>
          <Button
            type="button"
            size="sm"
            variant={thumb === "down" ? "default" : "outline"}
            onClick={() => setThumb("down")}
            className={cn("gap-1.5", thumb === "down" && "bg-red-600 hover:bg-red-700")}
          >
            <ThumbsDown className="size-3.5" />
            Negatief
          </Button>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || !thumb || feedback.isPending}
        >
          {feedback.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          )}
          Versturen
        </Button>
      </div>
    </form>
  );
}
