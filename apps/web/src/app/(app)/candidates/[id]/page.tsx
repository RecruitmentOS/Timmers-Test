"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useCandidate,
  useCandidateApplications,
  useCandidateTimeline,
  useCandidateFiles,
} from "@/hooks/use-candidates";
import { useCreateApplication } from "@/hooks/use-applications";
import { useVacancies } from "@/hooks/use-vacancies";
import { apiClient } from "@/lib/api-client";
import { CVParseReview } from "@/components/cv-parse/cv-parse-review";
import { DocumentList } from "@/components/documents/document-list";
import { AIScreeningTrigger } from "../components/ai-screening-trigger";
import { ScheduleInterview } from "../components/schedule-interview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  MapPin,
  Upload,
  FileText,
  Briefcase,
  Clock,
} from "lucide-react";

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: candidate, isLoading } = useCandidate(id);
  const { data: applications } = useCandidateApplications(id);
  const { data: timeline } = useCandidateTimeline(id);
  const { data: files, refetch: refetchFiles } = useCandidateFiles(id);
  const { data: vacancies } = useVacancies();
  const createApplicationMutation = useCreateApplication();

  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploadedFileId, setLastUploadedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!candidate) {
    return <p className="text-muted-foreground">Candidate not found.</p>;
  }

  const handleApplyToVacancy = async () => {
    if (!selectedVacancyId) return;
    await createApplicationMutation.mutateAsync({
      candidateId: id,
      vacancyId: selectedVacancyId,
    });
    setSelectedVacancyId("");
    setApplyDialogOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Get presigned upload URL
      const { url, key } = await apiClient<{ url: string; key: string }>(
        "/api/files/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            entityType: "candidate",
            entityId: id,
            filename: file.name,
            contentType: file.type,
          }),
        }
      );

      // 2. Upload file directly to R2
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // 3. Confirm upload (record metadata)
      const confirmed = await apiClient<{ id: string }>("/api/files/confirm", {
        method: "POST",
        body: JSON.stringify({
          entityType: "candidate",
          entityId: id,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          s3Key: key,
        }),
      });

      // 4. Trigger CV parse if it's a PDF
      if (file.type === "application/pdf" && confirmed?.id) {
        setLastUploadedFileId(confirmed.id);
        await apiClient("/api/cv-parse/trigger", {
          method: "POST",
          body: JSON.stringify({ fileId: confirmed.id, candidateId: id, s3Key: key }),
        });
      }

      refetchFiles();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {candidate.firstName} {candidate.lastName}
        </h1>
        <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="outline">
                <Briefcase className="mr-2 h-4 w-4" />
                Apply to Vacancy
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply to Vacancy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={selectedVacancyId}
                onValueChange={(v) => setSelectedVacancyId((v as string) ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vacancy" />
                </SelectTrigger>
                <SelectContent>
                  {(vacancies as any[])?.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleApplyToVacancy}
                disabled={!selectedVacancyId}
              >
                Create Application
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.phone || "No phone"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.city || "No city"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span>{candidate.source || "Unknown"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beschikbaarheid & Contract */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beschikbaarheid & Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Beschikbaarheid</span>
              <p className="mt-1 font-medium">
                {candidate.availabilityType === "direct"
                  ? "Direct beschikbaar"
                  : candidate.availabilityType === "opzegtermijn"
                    ? "Opzegtermijn"
                    : candidate.availabilityType === "in_overleg"
                      ? "In overleg"
                      : "Niet opgegeven"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Start datum</span>
              <p className="mt-1 font-medium">
                {candidate.availabilityStartDate
                  ? new Date(candidate.availabilityStartDate).toLocaleDateString("nl-NL")
                  : "Niet opgegeven"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Contract type</span>
              <p className="mt-1 font-medium">
                {candidate.contractType === "vast"
                  ? "Vast dienstverband"
                  : candidate.contractType === "tijdelijk"
                    ? "Tijdelijk contract"
                    : candidate.contractType === "uitzend"
                      ? "Uitzendovereenkomst"
                      : candidate.contractType === "zzp"
                        ? "ZZP / Freelance"
                        : "Niet opgegeven"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CV / Documents section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Documents</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload CV"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!(files as any[])?.length ? (
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {(files as any[]).map((f: any) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{f.filename}</span>
                  <span className="text-muted-foreground">
                    ({f.contentType})
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CV Parse Review Modal */}
      {lastUploadedFileId && (
        <CVParseReview
          fileId={lastUploadedFileId}
          open={!!lastUploadedFileId}
          onApply={(_data) => setLastUploadedFileId(null)}
          onClose={() => setLastUploadedFileId(null)}
        />
      )}

      {/* Typed Documents with Expiry */}
      <DocumentList candidateId={id} />

      {/* Applications section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {!(applications as any[])?.length ? (
            <p className="text-sm text-muted-foreground">
              Not applied to any vacancies yet.
            </p>
          ) : (
            <div className="space-y-3">
              {(applications as any[]).map((app: any) => (
                <div
                  key={app.id}
                  className="border-b pb-3 last:border-0 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/vacancies/${app.vacancyId}`}
                        className="font-medium hover:underline"
                      >
                        {app.vacancyTitle || "Vacancy"}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {app.qualificationStatus}
                        </Badge>
                        {app.vacancyStatus && (
                          <span className="text-xs text-muted-foreground">
                            {app.vacancyStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AIScreeningTrigger applicationId={app.id} />
                    <ScheduleInterview
                      applicationId={app.id}
                      vacancyId={app.vacancyId}
                      candidateId={id}
                      candidateName={`${candidate.firstName} ${candidate.lastName}`}
                      candidateEmail={candidate.email ?? undefined}
                      vacancyTitle={app.vacancyTitle || "Vacancy"}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!(timeline as any[])?.length ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {(timeline as any[]).map((entry: any) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p>
                      <span className="font-medium">{entry.action}</span> on{" "}
                      {entry.entityType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
