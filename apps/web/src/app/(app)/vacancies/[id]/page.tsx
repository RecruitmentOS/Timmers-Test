"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useVacancy,
  useVacancyApplications,
  useVacancyNotes,
  useAddVacancyNote,
  useVacancyAssignments,
} from "@/hooks/use-vacancies";
import { useCreateApplication } from "@/hooks/use-applications";
import { useCandidates } from "@/hooks/use-candidates";
import type { Vacancy } from "@recruitment-os/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar, UserPlus } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import VacancyCampaignsPage from "./campaigns/page";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  closed: "bg-red-100 text-red-800",
};

export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vacancy, isLoading } = useVacancy(id);
  const { data: applications } = useVacancyApplications(id);
  const { data: notes } = useVacancyNotes(id);
  const { data: assignments } = useVacancyAssignments(id);
  const addNoteMutation = useAddVacancyNote(id);
  const createApplicationMutation = useCreateApplication();
  const { data: allCandidates } = useCandidates();

  const [noteContent, setNoteContent] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!vacancy) {
    return <p className="text-muted-foreground">Vacancy not found.</p>;
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    await addNoteMutation.mutateAsync(noteContent);
    setNoteContent("");
  };

  const handleLinkCandidate = async () => {
    if (!selectedCandidateId) return;
    await createApplicationMutation.mutateAsync({
      candidateId: selectedCandidateId,
      vacancyId: id,
    });
    setSelectedCandidateId("");
    setLinkDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{vacancy.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            <Badge
              variant="secondary"
              className={STATUS_COLORS[vacancy.status] || ""}
            >
              {vacancy.status}
            </Badge>
            {vacancy.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {vacancy.location}
              </span>
            )}
            {vacancy.employmentType && (
              <span>{vacancy.employmentType}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Link Candidate
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Candidate to Vacancy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select
                  value={selectedCandidateId}
                  onValueChange={(v) => setSelectedCandidateId((v as string) ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allCandidates as any[])?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleLinkCandidate}
                  disabled={!selectedCandidateId}
                >
                  Create Application
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Description</span>
              <p className="mt-1">{vacancy.description || "No description"}</p>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(vacancy.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Updated</span>
                <p>{new Date(vacancy.updatedAt).toLocaleDateString()}</p>
              </div>
              {vacancy.hourlyRate && (
                <div>
                  <span className="text-muted-foreground">Uurtarief</span>
                  <p className="font-medium">&euro; {Number(vacancy.hourlyRate).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team section */}
      {(assignments as any[])?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(assignments as any[]).map((a: any) => (
                <Badge key={a.id} variant="outline">
                  {a.userId} ({a.role})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <TooltipProvider>
        <Tabs defaultValue="candidates">
          <TabsList>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <TabsTrigger value="tasks" disabled>
                  Tasks
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Coming in Phase 2</TooltipContent>
            </Tooltip>
            <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <TabsTrigger value="client-view" disabled>
                  Client View
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Coming in Phase 3</TooltipContent>
            </Tooltip>
          </TabsList>

          <TabsContent value="candidates" className="mt-4">
            {!(applications as any[])?.length ? (
              <p className="text-muted-foreground py-4">
                No candidates linked yet. Use "Link Candidate" to add one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(applications as any[]).map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link
                          href={`/candidates/${app.candidateId}`}
                          className="font-medium hover:underline"
                        >
                          {app.candidateFirstName} {app.candidateLastName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {app.qualificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.sourceDetail || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                onClick={handleAddNote}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
              >
                Add
              </Button>
            </div>
            {(notes as any[])?.map((note: any) => (
              <Card key={note.id}>
                <CardContent className="pt-4">
                  <p>{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    Qualification Criteria
                  </span>
                  <p className="mt-1">
                    {vacancy.qualificationCriteria
                      ? JSON.stringify(vacancy.qualificationCriteria)
                      : "None set"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client ID</span>
                  <p className="mt-1">{vacancy.clientId || "None"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Owner ID</span>
                  <p className="mt-1">{vacancy.ownerId}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4">
            <VacancyCampaignsPage />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Compact pipeline summary. Open the full board for
                drag-and-drop.
              </p>
              <Link
                href={`/vacancies/${id}/pipeline`}
                className="text-sm font-medium text-slate-900 underline"
              >
                Open full board →
              </Link>
            </div>
            <div className="border border-slate-200 rounded">
              <PipelineBoard vacancyId={id} compact />
            </div>
          </TabsContent>
        </Tabs>
      </TooltipProvider>
    </div>
  );
}
