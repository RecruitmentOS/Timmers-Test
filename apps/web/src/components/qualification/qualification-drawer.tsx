"use client";

/**
 * Qualification drawer — Linear-style sheet from the right.
 *
 * Collapses three Phase 1 flows (view, qualify, reject-reason) into a
 * single click. Verdict mapping (from 02-CONTEXT.md):
 *  - yes + save → advance to Qualified stage
 *  - no + reason + save → advance to Rejected/On hold
 *  - maybe → no stage change
 *
 * Copy is Dutch by default (Bart's working-style preference).
 */

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PipelineCard } from "@/hooks/use-pipeline";
import { useQualify } from "@/hooks/use-qualification";

type Props = {
  vacancyId: string;
  application: PipelineCard | null;
  onClose: () => void;
};

export function QualificationDrawer({
  vacancyId,
  application,
  onClose,
}: Props) {
  const [status, setStatus] = useState<"yes" | "maybe" | "no">("maybe");
  const [rejectReason, setRejectReason] = useState("");
  const [notes, setNotes] = useState("");
  const qualify = useQualify(vacancyId);

  useEffect(() => {
    if (application) {
      setStatus(
        application.qualificationStatus === "pending"
          ? "maybe"
          : application.qualificationStatus
      );
      setRejectReason("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id]);

  if (!application) return null;

  const fullName =
    [application.firstName, application.lastName]
      .filter(Boolean)
      .join(" ") || "Onbekend";

  const saveDisabled =
    qualify.isPending ||
    (status === "no" && rejectReason.trim().length === 0);

  return (
    <Sheet
      open={!!application}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-[min(480px,100vw)] sm:max-w-[480px]"
      >
        <SheetHeader>
          <SheetTitle>{fullName}</SheetTitle>
          <SheetDescription>
            Kwalificatie — kies je verdict en sla op.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Verdict
            </label>
            <div className="flex gap-2">
              {(["yes", "maybe", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatus(v)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    status === v
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {v === "yes"
                    ? "Ja"
                    : v === "maybe"
                      ? "Misschien"
                      : "Nee"}
                </button>
              ))}
            </div>
          </div>

          {status === "no" && (
            <div>
              <label
                htmlFor="qual-reject-reason"
                className="text-xs text-slate-500 mb-1 block"
              >
                Afwijsreden <span className="text-rose-600">*</span>
              </label>
              <input
                id="qual-reject-reason"
                className="w-full h-9 border border-slate-200 rounded px-2 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Bijv. geen C/CE rijbewijs"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="qual-notes"
              className="text-xs text-slate-500 mb-1 block"
            >
              Criteria notities
            </label>
            <textarea
              id="qual-notes"
              className="w-full min-h-24 border border-slate-200 rounded px-2 py-1 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ervaring, licenties, beschikbaarheid…"
            />
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Recente activiteit
            </h4>
            <p className="text-xs text-slate-400">
              Activiteitenlog komt in Phase 3 — voor nu zichtbaar op de
              kandidaatdetailpagina.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => {
                qualify.mutate(
                  {
                    applicationId: application.id,
                    status,
                    rejectReason:
                      status === "no" ? rejectReason : undefined,
                    qualificationNotes: notes || undefined,
                    advanceStage: status === "yes" || status === "no",
                  },
                  { onSuccess: onClose }
                );
              }}
              className="h-9 px-4 rounded bg-slate-900 text-white text-sm disabled:opacity-50"
            >
              {qualify.isPending ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded border border-slate-200 text-sm hover:bg-slate-50"
            >
              Annuleer
            </button>
            {qualify.isError && (
              <span className="text-xs text-rose-600 ml-2">
                Opslaan mislukt. Probeer opnieuw.
              </span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
