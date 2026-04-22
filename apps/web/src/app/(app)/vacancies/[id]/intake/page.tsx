// apps/web/src/app/(app)/vacancies/[id]/intake/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useVacancy } from "@/hooks/use-vacancies";
import { CriteriaEditor } from "@/components/intake/criteria-editor";
import { CriteriaAiSuggest } from "@/components/intake/criteria-ai-suggest";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { QualificationCriteria } from "@recruitment-os/types";

export default function VacancyIntakePage() {
  const { id } = useParams<{ id: string }>();
  const { data: vacancy } = useVacancy(id);
  const [criteria, setCriteria] = useState<QualificationCriteria>({ mustHave: {}, niceToHave: {} });
  const [intakeEnabled, setIntakeEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!vacancy) return;
    setCriteria((vacancy as any).qualificationCriteria ?? { mustHave: {}, niceToHave: {} });
    setIntakeEnabled(!!(vacancy as any).intakeEnabled);
  }, [vacancy]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient(`/api/vacancies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ intakeEnabled, qualificationCriteria: criteria }),
        headers: { "content-type": "application/json" },
      });
    } finally { setSaving(false); }
  };

  if (!vacancy) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Intake-instellingen: {vacancy.title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={intakeEnabled} onCheckedChange={setIntakeEnabled} id="intake-enabled" />
        <Label htmlFor="intake-enabled">Automatische WhatsApp-intake actief</Label>
      </div>
      <CriteriaAiSuggest
        vacancyId={id}
        onAccept={(s) => {
          if (s.type === "must") {
            setCriteria((c) => ({
              ...c,
              mustHave: {
                ...c.mustHave,
                customKeys: [...(c.mustHave.customKeys ?? []), {
                  key: s.key, question: s.question,
                  expectedFormat: s.expectedFormat, enumValues: s.enumValues, required: true,
                }],
              },
            }));
          }
        }}
      />
      <CriteriaEditor value={criteria} onChange={setCriteria} />
      <Button onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
    </div>
  );
}
