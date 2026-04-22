// apps/web/src/components/intake/verdict-card.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntakeSession } from "@recruitment-os/types";

export function VerdictCard({ session }: { session: IntakeSession }) {
  if (!session.verdict) return null;
  const color =
    session.verdict === "qualified" ? "bg-green-100 text-green-800" :
    session.verdict === "rejected" ? "bg-red-100 text-red-800" :
    "bg-amber-100 text-amber-800";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Verdict <Badge className={color}>{session.verdict}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{session.verdictReason}</p>
      </CardContent>
    </Card>
  );
}
