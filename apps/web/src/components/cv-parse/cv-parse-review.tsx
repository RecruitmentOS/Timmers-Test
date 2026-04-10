"use client";

import * as React from "react";
import { useCvParseStatus } from "@/hooks/use-cv-parse";
import type { CVParseResult } from "@recruitment-os/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2Icon, AlertCircleIcon } from "lucide-react";

const LICENSE_OPTIONS = ["B", "C", "CE", "D", "D1", "taxi"] as const;

interface CVParseReviewProps {
  fileId: string;
  onApply: (data: CVParseResult) => void;
  onClose: () => void;
  open: boolean;
}

export function CVParseReview({ fileId, onApply, onClose, open }: CVParseReviewProps) {
  const { data, isLoading } = useCvParseStatus(open ? fileId : null);
  const [editedData, setEditedData] = React.useState<CVParseResult>({});
  const [initialized, setInitialized] = React.useState(false);

  // Populate form when parse succeeds
  React.useEffect(() => {
    if (data?.status === "success" && data.parsedData && !initialized) {
      setEditedData(data.parsedData);
      setInitialized(true);
    }
  }, [data, initialized]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setEditedData({});
      setInitialized(false);
    }
  }, [open]);

  const updateField = <K extends keyof CVParseResult>(key: K, value: CVParseResult[K]) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLicense = (license: string) => {
    const current = editedData.licenseTypes ?? [];
    const next = current.includes(license)
      ? current.filter((l) => l !== license)
      : [...current, license];
    updateField("licenseTypes", next);
  };

  const handleApply = () => {
    onApply(editedData);
  };

  const handleManualEntry = () => {
    setEditedData({});
    setInitialized(true);
  };

  const status = data?.status;
  const isPending = isLoading || status === "pending" || status === "processing";
  const isError = status === "error";
  const isReady = status === "success" || initialized;

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CV Verwerking</DialogTitle>
          <DialogDescription>
            {isPending && "CV wordt verwerkt..."}
            {isError && !initialized && "Er is een fout opgetreden bij het verwerken van het CV."}
            {isReady && "Controleer en bewerk de gegevens voordat u ze toepast."}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isPending && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              CV wordt verwerkt... / Processing CV...
            </p>
          </div>
        )}

        {/* Error state */}
        {isError && !initialized && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertCircleIcon className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">
              {data?.errorMessage || "Parsing failed"}
            </p>
            <Button variant="outline" onClick={handleManualEntry}>
              Handmatig invullen / Enter manually
            </Button>
          </div>
        )}

        {/* Parsed data form */}
        {isReady && (
          <div className="space-y-6">
            {/* Personal Info */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Persoonlijke gegevens
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName">Voornaam</Label>
                  <Input
                    id="firstName"
                    value={editedData.firstName ?? ""}
                    onChange={(e) => updateField("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName">Achternaam</Label>
                  <Input
                    id="lastName"
                    value={editedData.lastName ?? ""}
                    onChange={(e) => updateField("lastName", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={editedData.email ?? ""}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="phone">Telefoon</Label>
                  <Input
                    id="phone"
                    value={editedData.phone ?? ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city">Woonplaats</Label>
                  <Input
                    id="city"
                    value={editedData.city ?? ""}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* Driver Qualifications */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Rijbewijzen
              </legend>
              <div className="flex flex-wrap gap-4">
                {LICENSE_OPTIONS.map((license) => (
                  <label key={license} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={editedData.licenseTypes?.includes(license) ?? false}
                      onCheckedChange={() => toggleLicense(license)}
                    />
                    {license}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editedData.hasCode95 ?? false}
                    onCheckedChange={(checked) => updateField("hasCode95", !!checked)}
                  />
                  Code 95
                </label>
                <div className="space-y-1">
                  <Label htmlFor="code95Expiry">Code 95 vervaldatum</Label>
                  <Input
                    id="code95Expiry"
                    type="date"
                    value={editedData.code95Expiry ?? ""}
                    onChange={(e) => updateField("code95Expiry", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editedData.hasADR ?? false}
                    onCheckedChange={(checked) => updateField("hasADR", !!checked)}
                  />
                  ADR
                </label>
                <div className="space-y-1">
                  <Label htmlFor="adrType">ADR type</Label>
                  <Input
                    id="adrType"
                    value={editedData.adrType ?? ""}
                    onChange={(e) => updateField("adrType", e.target.value)}
                    placeholder="basis / tank / klasse1 / klasse7"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="drivingYears">Rijervaring (jaren)</Label>
                <Input
                  id="drivingYears"
                  type="number"
                  min={0}
                  value={editedData.drivingExperienceYears ?? ""}
                  onChange={(e) =>
                    updateField(
                      "drivingExperienceYears",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </div>
            </fieldset>

            {/* Work Experience & Languages */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Werkervaring
              </legend>
              <div className="space-y-1">
                <Label htmlFor="experience">Samenvatting werkervaring</Label>
                <Textarea
                  id="experience"
                  rows={3}
                  value={editedData.workExperienceSummary ?? ""}
                  onChange={(e) => updateField("workExperienceSummary", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="languages">Talen (kommagescheiden)</Label>
                <Input
                  id="languages"
                  value={editedData.languages?.join(", ") ?? ""}
                  onChange={(e) =>
                    updateField(
                      "languages",
                      e.target.value
                        .split(",")
                        .map((l) => l.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="nl, en, pl, ro"
                />
              </div>
            </fieldset>
          </div>
        )}

        {/* Footer actions */}
        {isReady && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Annuleren
            </Button>
            <Button onClick={handleApply}>
              Toepassen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
