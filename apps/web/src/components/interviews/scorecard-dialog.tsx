"use client";

import { useState } from "react";
import { ClipboardList, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useInterviewScorecard, useSubmitScorecard } from "@/hooks/use-interviews";
import type { ScorecardCriterion, ScorecardRecommendation } from "@recruitment-os/types";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const DEFAULT_CRITERIA = [
  "Rijervaring",
  "Communicatie",
  "Veiligheidsbesef",
  "Motivatie",
];

const RECOMMENDATION_OPTIONS: { value: ScorecardRecommendation; label: string; color: string }[] = [
  { value: "proceed", label: "✅ Doorgaan", color: "border-emerald-500 bg-emerald-50 text-emerald-700" },
  { value: "hold", label: "⏸️ On hold", color: "border-amber-500 bg-amber-50 text-amber-700" },
  { value: "reject", label: "❌ Afwijzen", color: "border-rose-500 bg-rose-50 text-rose-700" },
];

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface ScorecardDialogProps {
  interviewId: string;
  scheduledAt: string;
}

export function ScorecardDialog({ interviewId, scheduledAt }: ScorecardDialogProps) {
  const [open, setOpen] = useState(false);
  const { data } = useInterviewScorecard(interviewId);
  const submitMutation = useSubmitScorecard(interviewId);

  const existing = data?.scorecard;

  const [criteria, setCriteria] = useState<ScorecardCriterion[]>(() =>
    existing
      ? existing.criteria
      : DEFAULT_CRITERIA.map((label) => ({ label, rating: 0, notes: "" }))
  );
  const [overallRating, setOverallRating] = useState(existing?.overallRating ?? 0);
  const [recommendation, setRecommendation] = useState<ScorecardRecommendation | "">(
    existing?.recommendation ?? ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function updateCriterion(index: number, patch: Partial<ScorecardCriterion>) {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  }

  async function handleSubmit() {
    if (!recommendation || overallRating === 0) return;
    await submitMutation.mutateAsync({
      criteria,
      overallRating,
      recommendation,
      notes: notes || undefined,
    });
    setOpen(false);
  }

  const interviewDate = format(new Date(scheduledAt), "d MMM yyyy", { locale: nl });
  const hasScorecard = !!existing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={hasScorecard ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5", hasScorecard && "bg-indigo-600 hover:bg-indigo-700")}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {hasScorecard ? "Scorecard bekijken" : "Scorecard invullen"}
          </Button>
        }
      />
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Interview scorecard — {interviewDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Criteria ratings */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Beoordelingscriteria
            </p>
            {criteria.map((criterion, idx) => (
              <div key={criterion.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{criterion.label}</p>
                  <StarRating
                    value={criterion.rating}
                    onChange={(v) => updateCriterion(idx, { rating: v })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Toelichting (optioneel)..."
                  value={criterion.notes}
                  onChange={(e) => updateCriterion(idx, { notes: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}
          </div>

          {/* Overall rating */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Eindcijfer
            </p>
            <StarRating value={overallRating} onChange={setOverallRating} />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Aanbeveling
            </p>
            <div className="flex gap-2 flex-wrap">
              {RECOMMENDATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecommendation(opt.value)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all",
                    recommendation === opt.value
                      ? opt.color + " border-current"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* General notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Algemene notities
            </p>
            <Textarea
              placeholder="Bijzonderheden, indrukken, aandachtspunten..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!recommendation || overallRating === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? "Opslaan..." : hasScorecard ? "Bijwerken" : "Scorecard opslaan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
