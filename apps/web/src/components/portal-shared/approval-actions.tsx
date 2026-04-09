"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useSubmitFeedback } from "@/hooks/use-portal";

type Props = {
  applicationId: string;
  portalType: "client" | "hm";
  onAction?: () => void;
};

/**
 * ApprovalActions — approve/reject buttons for portal candidate review.
 *
 * "Goedkeuren" sends thumbs up immediately.
 * "Afwijzen" opens a dialog requiring a rejection reason textarea.
 */
export function ApprovalActions({ applicationId, portalType, onAction }: Props) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const feedback = useSubmitFeedback(portalType);

  function handleApprove() {
    feedback.mutate(
      {
        applicationId,
        body: "Goedgekeurd",
        feedbackThumb: "up",
      },
      { onSuccess: () => onAction?.() }
    );
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    feedback.mutate(
      {
        applicationId,
        body: rejectReason,
        feedbackThumb: "down",
      },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason("");
          onAction?.();
        },
      }
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={handleApprove}
        disabled={feedback.isPending}
        className="gap-1.5"
      >
        {feedback.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="size-3.5" />
        )}
        Goedkeuren
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setRejectOpen(true)}
        disabled={feedback.isPending}
        className="gap-1.5"
      >
        <ThumbsDown className="size-3.5" />
        Afwijzen
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reden voor afwijzing</DialogTitle>
            <DialogDescription>
              Geef een reden op waarom deze kandidaat wordt afgewezen.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Voer de reden voor afwijzing in..."
            rows={4}
            required
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || feedback.isPending}
            >
              {feedback.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
