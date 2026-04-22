"use client";
import { useIntakeTemplates } from "@/hooks/use-intake";
import { TemplateEditor } from "@/components/intake/template-editor";

export default function IntakeTemplatesPage() {
  const { data } = useIntakeTemplates();
  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Intake-templates</h1>
      {data?.templates.map((t) => <TemplateEditor key={t.id} template={t} />)}
      {data?.templates.length === 0 && <p>Geen templates gevonden — run seed.</p>}
    </div>
  );
}
