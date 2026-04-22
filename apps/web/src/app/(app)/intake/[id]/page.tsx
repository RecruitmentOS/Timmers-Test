// apps/web/src/app/(app)/intake/[id]/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useIntakeSession } from "@/hooks/use-intake";
import { SessionTranscript } from "@/components/intake/session-transcript";
import { MustHaveChecklist } from "@/components/intake/must-have-checklist";
import { VerdictCard } from "@/components/intake/verdict-card";
import { TakeoverDialog } from "@/components/intake/takeover-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntakeSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useIntakeSession(id);

  if (isLoading || !data) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  const { session, messages } = data;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Intake sessie</h1>
          <Badge>{session.state}</Badge>
        </div>
        {session.state !== "completed" && <TakeoverDialog sessionId={session.id} />}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SessionTranscript messages={messages} />
        </div>
        <div className="w-72 border-l p-4 space-y-4 bg-white">
          <MustHaveChecklist
            criteria={{}}
            answers={session.mustHaveAnswers as Record<string, unknown>}
            stuck={session.stuckCounter as Record<string, number>}
          />
          {session.verdict && <VerdictCard session={session} />}
        </div>
      </div>
    </div>
  );
}
