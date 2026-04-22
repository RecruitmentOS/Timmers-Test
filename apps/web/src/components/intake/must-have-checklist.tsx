// apps/web/src/components/intake/must-have-checklist.tsx
"use client";
import { Check, Circle, AlertCircle } from "lucide-react";

export function MustHaveChecklist({
  criteria,
  answers,
  stuck,
}: {
  criteria: Record<string, unknown>;
  answers: Record<string, unknown>;
  stuck: Record<string, number>;
}) {
  const keys = Object.keys(criteria ?? {}).filter((k) => k !== "customKeys");
  const customKeys = (criteria?.customKeys as Array<{ key: string }> | undefined) ?? [];

  function status(k: string) {
    if (answers[k] !== undefined) return "done";
    if ((stuck[k] ?? 0) > 0) return "stuck";
    return "pending";
  }

  const all = [...keys, ...customKeys.map((c) => c.key)];

  return (
    <div className="space-y-1 text-sm">
      <h3 className="font-semibold mb-2">Must-haves</h3>
      {all.map((k) => {
        const s = status(k);
        return (
          <div key={k} className="flex items-center gap-2">
            {s === "done" && <Check className="size-4 text-green-600" />}
            {s === "stuck" && <AlertCircle className="size-4 text-amber-600" />}
            {s === "pending" && <Circle className="size-4 text-slate-400" />}
            <span className={s === "done" ? "text-slate-700" : "text-slate-500"}>{k}</span>
          </div>
        );
      })}
      {all.length === 0 && <p className="text-xs text-muted-foreground">Geen must-haves geconfigureerd.</p>}
    </div>
  );
}
