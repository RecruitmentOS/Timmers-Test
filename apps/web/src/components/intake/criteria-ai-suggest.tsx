// apps/web/src/components/intake/criteria-ai-suggest.tsx
"use client";
import { Button } from "@/components/ui/button";
import { useCriteriaSuggest } from "@/hooks/use-intake";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function CriteriaAiSuggest({ vacancyId, onAccept }: {
  vacancyId: string;
  onAccept: (suggestions: any) => void;
}) {
  const suggest = useCriteriaSuggest();
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={() => suggest.mutate(vacancyId)}
        disabled={suggest.isPending}
      >
        <Sparkles className="size-4 mr-1" />
        {suggest.isPending ? "Aan het analyseren..." : "AI-check ontbrekende critical info"}
      </Button>
      {!!suggest.data && (
        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            <p className="italic text-muted-foreground">{(suggest.data as any).reasoning}</p>
            {((suggest.data as any).suggestedMustHaves ?? []).map((s: any) => (
              <div key={s.key} className="border rounded p-2">
                <p className="font-medium">Must-have: {s.key}</p>
                <p className="text-xs text-muted-foreground">{s.question}</p>
                <Button size="sm" variant="outline" onClick={() => onAccept({ type: "must", ...s })}>
                  Toevoegen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
