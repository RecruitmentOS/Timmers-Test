// apps/web/src/components/intake/criteria-editor.tsx
"use client";
import * as React from "react";
import type { QualificationCriteria } from "@recruitment-os/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CriteriaEditor({
  value,
  onChange,
}: {
  value: QualificationCriteria;
  onChange: (v: QualificationCriteria) => void;
}) {
  const mh = value.mustHave ?? {};
  const nth = value.niceToHave ?? {};

  function updateMust(patch: Partial<typeof mh>) {
    onChange({ ...value, mustHave: { ...mh, ...patch } });
  }
  function updateNice(patch: Partial<typeof nth>) {
    onChange({ ...value, niceToHave: { ...nth, ...patch } });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Must-haves</h3>

        <div className="space-y-2">
          <Label>Licenties (komma-gescheiden)</Label>
          <Input
            value={(mh.licenses ?? []).join(", ")}
            onChange={(e) => updateMust({ licenses: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="CE, code95, ADR"
          />
        </div>

        <div className="space-y-2">
          <Label>Vertical</Label>
          <Select value={mh.vertical ?? ""} onValueChange={(v) => updateMust({ vertical: (v || undefined) as any })}>
            <SelectTrigger><SelectValue placeholder="Kies vertical" /></SelectTrigger>
            <SelectContent>
              {["security", "traffic", "bouw", "zorg", "infra"].map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Beschikbaarheid</Label>
          <Select value={mh.availability ?? ""} onValueChange={(v) => updateMust({ availability: (v || undefined) as any })}>
            <SelectTrigger><SelectValue placeholder="Kies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fulltime">Fulltime</SelectItem>
              <SelectItem value="parttime">Parttime</SelectItem>
              <SelectItem value="flexible">Flexibel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Nice-to-haves</h3>
        <div className="space-y-2">
          <Label>Min. ervaring (jaren)</Label>
          <Input
            type="number" min={0}
            value={nth.experienceYearsMin ?? ""}
            onChange={(e) => updateNice({ experienceYearsMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Vrije tekst (context voor Claude)</Label>
          <Textarea
            rows={3}
            value={nth.freeText ?? ""}
            onChange={(e) => updateNice({ freeText: e.target.value })}
            placeholder="Bv. 'Bij voorkeur ervaring met internationale ritten'"
          />
        </div>
      </div>
    </div>
  );
}
