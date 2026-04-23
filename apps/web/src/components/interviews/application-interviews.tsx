"use client";

import { useInterviews } from "@/hooks/use-interviews";
import { ScorecardDialog } from "./scorecard-dialog";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar } from "lucide-react";

interface ApplicationInterviewsProps {
  applicationId: string;
}

export function ApplicationInterviews({ applicationId }: ApplicationInterviewsProps) {
  const { data: interviews = [] } = useInterviews({ applicationId });

  if (interviews.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {interviews.map((interview) => (
        <div
          key={interview.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">
              {format(new Date(interview.scheduledAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
            </span>
            {interview.location && (
              <span className="text-muted-foreground ml-2">· {interview.location}</span>
            )}
            <span
              className={
                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                (interview.status === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : interview.status === "cancelled"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-blue-100 text-blue-700")
              }
            >
              {interview.status === "completed" ? "Afgerond" : interview.status === "cancelled" ? "Geannuleerd" : "Gepland"}
            </span>
          </div>
          <ScorecardDialog
            interviewId={interview.id}
            scheduledAt={interview.scheduledAt}
          />
        </div>
      ))}
    </div>
  );
}
