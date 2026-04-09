"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Send, ChevronRight } from "lucide-react";
import {
  useAgentCandidates,
  useAgentMoveStage,
  useAgentAddNote,
  type AgentCandidate,
} from "@/hooks/use-agent-portal";

/**
 * Qualification status indicator — small colored dot.
 */
function QualificationDot({
  status,
}: {
  status: AgentCandidate["qualificationStatus"];
}) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-400",
    yes: "bg-green-500",
    maybe: "bg-orange-400",
    no: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-gray-400"}`}
      title={status}
    />
  );
}

/**
 * Inline note form — appears when agent clicks "Notitie toevoegen".
 */
function InlineNoteForm({
  applicationId,
  onClose,
}: {
  applicationId: string;
  onClose: () => void;
}) {
  const [body, setBody] = React.useState("");
  const addNote = useAgentAddNote();
  const t = useTranslations("portal.agent");

  function handleSubmit() {
    if (!body.trim()) return;
    addNote.mutate(
      { applicationId, body: body.trim() },
      { onSuccess: () => onClose() }
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Notitie..."
        className="min-h-[60px] text-sm"
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || addNote.isPending}
        >
          <Send className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          &times;
        </Button>
      </div>
    </div>
  );
}

/**
 * Agent candidate list row — dedicated minimal design per D-12.
 * Shows candidate info, stage badge, qualification dot, quick actions.
 */
function CandidateRow({ candidate }: { candidate: AgentCandidate }) {
  const [showNote, setShowNote] = React.useState(false);
  const [showStageSelect, setShowStageSelect] = React.useState(false);
  const moveStage = useAgentMoveStage();

  function handleStageChange(stageId: string) {
    moveStage.mutate({
      applicationId: candidate.applicationId,
      stageId,
    });
    setShowStageSelect(false);
  }

  return (
    <li className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <QualificationDot status={candidate.qualificationStatus} />
            <span className="font-semibold text-sm truncate">
              {candidate.candidateFirstName} {candidate.candidateLastName}
            </span>
          </div>
          <p className="text-muted-foreground text-sm truncate mt-0.5">
            {candidate.vacancyTitle}
            {candidate.candidateCity && ` \u2014 ${candidate.candidateCity}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {candidate.stageName && (
            <Badge variant="secondary" className="text-xs">
              {candidate.stageName}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setShowStageSelect(true)}>
                <ChevronRight className="mr-2 h-4 w-4" />
                Verplaats naar...
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowNote(true)}>
                Notitie toevoegen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showStageSelect && (
        <StageSelector
          onSelect={handleStageChange}
          onCancel={() => setShowStageSelect(false)}
        />
      )}

      {showNote && (
        <InlineNoteForm
          applicationId={candidate.applicationId}
          onClose={() => setShowNote(false)}
        />
      )}
    </li>
  );
}

/**
 * Simple stage selector — hardcoded common stages.
 * In production this would fetch from the pipeline stages API,
 * but for the agent portal we keep it simple with standard stages.
 */
function StageSelector({
  onSelect,
  onCancel,
}: {
  onSelect: (stageId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <p className="text-sm text-muted-foreground">Verplaats naar:</p>
      <Select onValueChange={(val) => val && onSelect(val as string)}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder="Kies fase..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">Nieuw</SelectItem>
          <SelectItem value="screening">Screening</SelectItem>
          <SelectItem value="qualified">Gekwalificeerd</SelectItem>
          <SelectItem value="interview">Interview</SelectItem>
          <SelectItem value="offer">Aanbod</SelectItem>
          <SelectItem value="hired">Aangenomen</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Annuleer
      </Button>
    </div>
  );
}

/**
 * AgentCandidateList — dedicated minimal candidate list for agent portal.
 *
 * Per D-12: This is a CUSTOM-BUILT simple list component.
 * Does NOT import from candidate-list-table or use @tanstack/react-table.
 * No bulk actions, no checkbox selection.
 */
export function AgentCandidateList() {
  const { data: candidates, isLoading, error } = useAgentCandidates();
  const t = useTranslations("portal.agent");

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        Er is een fout opgetreden bij het laden van kandidaten.
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">Geen kandidaten</p>
        <p className="text-sm mt-1">
          Er zijn nog geen kandidaten aan je toegewezen.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border bg-card">
      {candidates.map((candidate) => (
        <CandidateRow key={candidate.applicationId} candidate={candidate} />
      ))}
    </ul>
  );
}
