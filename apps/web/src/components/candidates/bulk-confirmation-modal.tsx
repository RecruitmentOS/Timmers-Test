"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BulkActionInput } from "@/hooks/use-bulk-actions";

/**
 * BulkConfirmationModal
 *
 * Modal rendered via the Base UI Dialog primitive (render-prop pattern —
 * NEVER Radix `asChild`). Appears whenever the user triggers a bulk
 * action from the toolbar.
 *
 * CRITICAL scope rule: this component builds a `BulkActionInput` (action
 * + payload only — never the target id array and never the search
 * criteria object) and hands it to `onConfirm`. The page-level
 * `useBulkActionsHandler` decides the transport path.
 */

export type BulkMode = "move" | "reject" | "assign" | "tag";

type Props = {
  open: boolean;
  mode: BulkMode | null;
  count: number;
  availableStages: { id: string; name: string }[];
  availableOwners: { id: string; name: string }[];
  onConfirm: (action: BulkActionInput) => void;
  onCancel: () => void;
};

export function BulkConfirmationModal({
  open,
  mode,
  count,
  availableStages,
  availableOwners,
  onConfirm,
  onCancel,
}: Props) {
  // Local draft state per mode — reset whenever the modal opens/changes.
  const [stageId, setStageId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [tag, setTag] = useState<string>("");

  useEffect(() => {
    if (open) {
      setStageId("");
      setRejectReason("");
      setOwnerId("");
      setTag("");
    }
  }, [open, mode]);

  if (!mode) return null;

  const title = {
    move: "Verplaatsen naar stage",
    reject: "Kandidaten afwijzen",
    assign: "Eigenaar toewijzen",
    tag: "Label toevoegen",
  }[mode];

  const canConfirm = (() => {
    switch (mode) {
      case "move":
        return stageId.length > 0;
      case "reject":
        return rejectReason.trim().length >= 3;
      case "assign":
        return ownerId.length > 0;
      case "tag":
        return tag.trim().length >= 1;
    }
  })();

  function handleConfirm() {
    switch (mode) {
      case "move":
        onConfirm({ action: "move", payload: { stageId } });
        return;
      case "reject":
        onConfirm({ action: "reject", payload: { rejectReason } });
        return;
      case "assign":
        onConfirm({ action: "assign", payload: { ownerId } });
        return;
      case "tag":
        onConfirm({ action: "tag", payload: { tag } });
        return;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Deze actie wordt uitgevoerd op{" "}
            <strong>{count} kandidaten</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {mode === "move" && (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-stage">Stage</Label>
              <Select
                value={stageId}
                onValueChange={(v) => setStageId((v as string) ?? "")}
              >
                <SelectTrigger id="bulk-stage" className="w-full">
                  <SelectValue placeholder="Kies een stage" />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "reject" && (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-reason">Afwijsreden</Label>
              <Textarea
                id="bulk-reason"
                placeholder="Waarom worden deze kandidaten afgewezen?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {mode === "assign" && (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-owner">Eigenaar</Label>
              <Select
                value={ownerId}
                onValueChange={(v) => setOwnerId((v as string) ?? "")}
              >
                <SelectTrigger id="bulk-owner" className="w-full">
                  <SelectValue placeholder="Kies een eigenaar" />
                </SelectTrigger>
                <SelectContent>
                  {availableOwners.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableOwners.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Geen eigenaren beschikbaar.
                </p>
              )}
            </div>
          )}

          {mode === "tag" && (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tag">Label</Label>
              <Input
                id="bulk-tag"
                placeholder="Bijv. ADR, code-95, NL-licentie"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Uitvoeren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
