"use client";

/**
 * Placement drawer -- slide-over to create/view a placement when a candidate
 * reaches the "Hired"/"Aangenomen" stage.
 *
 * Uses shadcn Sheet (same pattern as QualificationDrawer). TanStack Query
 * for data fetching and mutations against /api/placements.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Placement,
  CreatePlacementInput,
} from "@recruitment-os/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

type Props = {
  applicationId: string | null;
  /** Pre-fill the rate from the vacancy hourlyRate if available */
  defaultRate?: number | null;
  onClose: () => void;
};

export function PlacementDrawer({
  applicationId,
  defaultRate,
  onClose,
}: Props) {
  const qc = useQueryClient();

  // Fetch existing placement for this application
  const { data: existingPlacement, isLoading } = useQuery<Placement | null>({
    queryKey: ["placement", applicationId],
    queryFn: async () => {
      try {
        return await apiClient<Placement>(
          `/api/placements/application/${applicationId}`
        );
      } catch {
        // No placement exists yet — that's fine
        return null;
      }
    },
    enabled: !!applicationId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [agreedRate, setAgreedRate] = useState<string>("");
  const [inlenersbeloning, setInlenersbeloning] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when application changes or data loads
  useEffect(() => {
    if (existingPlacement) {
      setAgreedRate(
        existingPlacement.agreedRate
          ? String(Number(existingPlacement.agreedRate))
          : ""
      );
      setInlenersbeloning(existingPlacement.inlenersbeloning);
      setStartDate(
        existingPlacement.startDate
          ? new Date(existingPlacement.startDate).toISOString().split("T")[0]
          : ""
      );
      setNotes(existingPlacement.notes ?? "");
      setIsEditing(false);
    } else {
      // New placement mode
      setAgreedRate(defaultRate ? String(defaultRate) : "");
      setInlenersbeloning(false);
      setStartDate("");
      setNotes("");
      setIsEditing(true);
    }
  }, [existingPlacement, applicationId, defaultRate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePlacementInput) =>
      apiClient<Placement>("/api/placements", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placement", applicationId] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      setIsEditing(false);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Record<string, unknown> }) =>
      apiClient<Placement>(`/api/placements/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placement", applicationId] });
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    if (!applicationId) return;

    const payload = {
      agreedRate: agreedRate ? Number(agreedRate) : undefined,
      inlenersbeloning,
      startDate: startDate || undefined,
      notes: notes || undefined,
    };

    if (existingPlacement) {
      updateMutation.mutate({ id: existingPlacement.id, body: payload });
    } else {
      createMutation.mutate({ applicationId, ...payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet
      open={!!applicationId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-[min(480px,100vw)] sm:max-w-[480px]"
      >
        <SheetHeader>
          <SheetTitle>Plaatsing</SheetTitle>
          <SheetDescription>
            {existingPlacement
              ? "Bekijk of bewerk de plaatsinggegevens."
              : "Maak een plaatsing aan voor deze kandidaat."}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Laden...
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-4">
            {/* Agreed rate */}
            <div className="space-y-1">
              <Label htmlFor="placement-rate">Afgesproken tarief (EUR/uur)</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    &euro;
                  </span>
                  <Input
                    id="placement-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={agreedRate}
                    onChange={(e) => setAgreedRate(e.target.value)}
                    placeholder="23.00"
                  />
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {agreedRate ? `\u20AC ${Number(agreedRate).toFixed(2)}` : "Niet opgegeven"}
                </p>
              )}
            </div>

            {/* Inlenersbeloning toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="placement-inlenersbeloning">
                  Inlenersbeloning van toepassing
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Wettelijk verplicht voor uitzendkrachten conform ABU/NBBU cao
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {isEditing ? (
                <Switch
                  id="placement-inlenersbeloning"
                  checked={inlenersbeloning}
                  onCheckedChange={setInlenersbeloning}
                />
              ) : (
                <span className="text-sm font-medium">
                  {inlenersbeloning ? "Ja" : "Nee"}
                </span>
              )}
            </div>

            {/* Start date */}
            <div className="space-y-1">
              <Label htmlFor="placement-start-date">Startdatum</Label>
              {isEditing ? (
                <Input
                  id="placement-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">
                  {startDate
                    ? new Date(startDate).toLocaleDateString("nl-NL")
                    : "Niet opgegeven"}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="placement-notes">Notities</Label>
              {isEditing ? (
                <Textarea
                  id="placement-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bijv. afspraken over proeftijd, reiskosten..."
                  rows={3}
                />
              ) : (
                <p className="text-sm">
                  {notes || "Geen notities"}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={isSaving} size="sm">
                    {isSaving
                      ? "Opslaan..."
                      : existingPlacement
                        ? "Bijwerken"
                        : "Plaatsing aanmaken"}
                  </Button>
                  {existingPlacement && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Annuleer
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Bewerken
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                Sluiten
              </Button>
              {(createMutation.isError || updateMutation.isError) && (
                <span className="text-xs text-rose-600 ml-2">
                  Opslaan mislukt. Probeer opnieuw.
                </span>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
