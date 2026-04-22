"use client";
import { useState, useEffect } from "react";
import type { IntakeTemplate } from "@recruitment-os/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUpdateIntakeTemplate } from "@/hooks/use-intake";

const MERGE_FIELDS = [
  "{{candidate.first_name}}", "{{candidate.full_name}}",
  "{{vacancy.title}}", "{{vacancy.location}}",
  "{{client.name}}", "{{tenant.name}}",
  "{{recruiter.name}}", "{{recruiter.phone}}",
];

export function TemplateEditor({ template }: { template: IntakeTemplate }) {
  const [body, setBody] = useState(template.body);
  const [name, setName] = useState(template.name);
  const update = useUpdateIntakeTemplate();

  useEffect(() => { setBody(template.body); setName(template.name); }, [template.id]);

  return (
    <div className="space-y-3 p-4 border rounded">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{template.variant}</h3>
        <span className="text-xs text-muted-foreground">status: {template.wabaStatus}</span>
      </div>
      <Label>Naam</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Label>Bericht</Label>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      <div className="flex flex-wrap gap-1">
        {MERGE_FIELDS.map((f) => (
          <button
            key={f} type="button"
            className="text-xs px-2 py-0.5 bg-slate-100 rounded hover:bg-slate-200"
            onClick={() => setBody((b) => b + " " + f)}
          >{f}</button>
        ))}
      </div>
      <Button
        onClick={() => update.mutate({ id: template.id, body, name })}
        disabled={update.isPending}
      >Opslaan</Button>
    </div>
  );
}
