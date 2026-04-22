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
import { useDocuments } from "@/hooks/use-documents";
import { usePipelineStages } from "@/hooks/use-admin";
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
import {
  Phone,
  Mail,
  MapPin,
  Upload,
  FileText,
  Briefcase,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
  User,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const QUAL_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  yes: "bg-emerald-100 text-emerald-700",
  maybe: "bg-amber-100 text-amber-700",
  no: "bg-rose-100 text-rose-700",
};

const QUAL_LABELS: Record<string, string> = {
  pending: "Open",
  yes: "Gekwalificeerd",
  maybe: "Mogelijk",
  no: "Afgewezen",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  direct: "Direct beschikbaar",
  opzegtermijn: "Opzegtermijn",
  in_overleg: "In overleg",
};

const CONTRACT_LABELS: Record<string, string> = {
  vast: "Vast dienstverband",
  tijdelijk: "Tijdelijk contract",
  uitzend: "Uitzendovereenkomst",
  zzp: "ZZP / Freelance",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cv: "CV",
  license: "Rijbewijs",
  code95: "Code 95",
  adr: "ADR",
  id: "ID",
};

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  cv: "📄",
  license: "🚗",
  code95: "📋",
  adr: "⚠️",
  id: "🪪",
};

const TABS = ["Overzicht", "Sollicitaties", "Documenten", "Journey"] as const;
type Tab = (typeof TABS)[number];

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: candidate, isLoading } = useCandidate(id);
  const { data: applications } = useCandidateApplications(id);
  const { data: timeline } = useCandidateTimeline(id);
  const { data: files, refetch: refetchFiles } = useCandidateFiles(id);
  const { data: documents } = useDocuments(id);
  const { data: stages } = usePipelineStages();
  const { data: vacancies } = useVacancies();
  const createApplicationMutation = useCreateApplication();

  const [activeTab, setActiveTab] = useState<Tab>("Overzicht");
  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploadedFileId, setLastUploadedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-[1fr_300px] gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!candidate) {
    return <p className="text-muted-foreground">Kandidaat niet gevonden.</p>;
  }

  const firstName = candidate.firstName ?? "";
  const lastName = candidate.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "Onbekend";
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?";

  const appList = (applications as any[]) ?? [];
  const timelineList = (timeline as any[]) ?? [];
  const fileList = (files as any[]) ?? [];
  const documentList = (documents as any[]) ?? [];
  const stageList = (stages ?? []).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  // Document type presence for dossier
  const presentDocTypes = new Set(documentList.map((d: any) => d.documentType as string));

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
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {candidate.source ? `Bron: ${candidate.source}` : "Kandidaat"} ·{" "}
            Toegevoegd{" "}
            {new Date(candidate.createdAt).toLocaleDateString("nl-NL")}
          </p>
        </div>
        <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Briefcase className="mr-2 h-4 w-4" />
                Koppelen aan vacature
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Koppelen aan vacature</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={selectedVacancyId}
                onValueChange={(v) => setSelectedVacancyId((v as string) ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een vacature" />
                </SelectTrigger>
                <SelectContent>
                  {(vacancies as any[])?.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleApplyToVacancy} disabled={!selectedVacancyId}>
                Sollicitatie aanmaken
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main layout: content + dossier sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Main content */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex rounded-full border bg-muted p-0.5 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  activeTab === tab
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {tab === "Sollicitaties" && appList.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs">
                    {appList.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overzicht tab */}
          {activeTab === "Overzicht" && (
            <div className="space-y-4">
              {/* Contact info */}
              <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contactgegevens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{candidate.phone || "Niet opgegeven"}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      {candidate.email ? (
                        <a
                          href={`mailto:${candidate.email}`}
                          className="text-primary hover:underline truncate"
                        >
                          {candidate.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Niet opgegeven</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{candidate.city || "Niet opgegeven"}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{candidate.source || "Onbekende bron"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Availability & Contract */}
              <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Beschikbaarheid & Contract</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Beschikbaarheid</p>
                      <p className="text-sm font-medium">
                        {candidate.availabilityType
                          ? AVAILABILITY_LABELS[candidate.availabilityType] ?? candidate.availabilityType
                          : "Niet opgegeven"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Startdatum</p>
                      <p className="text-sm font-medium">
                        {candidate.availabilityStartDate
                          ? new Date(candidate.availabilityStartDate).toLocaleDateString("nl-NL")
                          : "Niet opgegeven"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Contract type</p>
                      <p className="text-sm font-medium">
                        {candidate.contractType
                          ? CONTRACT_LABELS[candidate.contractType] ?? candidate.contractType
                          : "Niet opgegeven"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Sollicitaties",
                    value: appList.length,
                    icon: <Briefcase className="h-4 w-4 text-violet-600" />,
                    accent: "bg-violet-100",
                  },
                  {
                    label: "Documenten",
                    value: documentList.length + fileList.length,
                    icon: <FileText className="h-4 w-4 text-blue-600" />,
                    accent: "bg-blue-100",
                  },
                  {
                    label: "Activiteiten",
                    value: timelineList.length,
                    icon: <Clock className="h-4 w-4 text-amber-600" />,
                    accent: "bg-amber-100",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm ring-1 ring-border/60 flex items-center gap-3"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        stat.accent
                      )}
                    >
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-semibold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sollicitaties tab */}
          {activeTab === "Sollicitaties" && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Sollicitaties{" "}
                  {appList.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      ({appList.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {appList.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">
                    Nog geen sollicitaties.
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {appList.map((app: any) => (
                      <div key={app.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/vacancies/${app.vacancyId}`}
                              className="text-sm font-medium hover:underline text-foreground flex items-center gap-1"
                            >
                              {app.vacancyTitle || "Vacature"}
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </Link>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  QUAL_COLORS[app.qualificationStatus ?? "pending"]
                                )}
                              >
                                {QUAL_LABELS[app.qualificationStatus ?? "pending"]}
                              </Badge>
                              {app.currentStageName && (
                                <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                  {app.currentStageName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(app.createdAt).toLocaleDateString("nl-NL")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <AIScreeningTrigger applicationId={app.id} />
                          <ScheduleInterview
                            applicationId={app.id}
                            vacancyId={app.vacancyId}
                            candidateId={id}
                            candidateName={fullName}
                            candidateEmail={candidate.email ?? undefined}
                            vacancyTitle={app.vacancyTitle || "Vacature"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Documenten tab */}
          {activeTab === "Documenten" && (
            <div className="space-y-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Bestanden uploaden</CardTitle>
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
                        {uploading ? "Uploading..." : "CV uploaden"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {fileList.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      {fileList.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{f.filename}</span>
                          <span className="text-muted-foreground text-xs">
                            {f.contentType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              <DocumentList candidateId={id} />
            </div>
          )}

          {/* Journey tab */}
          {activeTab === "Journey" && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activiteiten</CardTitle>
              </CardHeader>
              <CardContent>
                {timelineList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen activiteiten.</p>
                ) : (
                  <div className="space-y-4">
                    {timelineList.map((entry: any, i: number) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                          </div>
                          {i < timelineList.length - 1 && (
                            <div className="w-px flex-1 bg-border/60 mt-1" />
                          )}
                        </div>
                        <div className="pb-4 min-w-0">
                          <p className="text-sm font-medium">
                            {entry.action}{" "}
                            <span className="font-normal text-muted-foreground">
                              op {entry.entityType}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(entry.createdAt).toLocaleString("nl-NL")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dossier sidebar */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Candidate card */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{fullName}</p>
                  {candidate.city && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {candidate.city}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {candidate.source && (
                    <span className="text-xs rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                      {candidate.source}
                    </span>
                  )}
                  {candidate.availabilityType && (
                    <span className="text-xs rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5">
                      {AVAILABILITY_LABELS[candidate.availabilityType]}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline voortgang */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Pijplijn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {appList.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nog niet gekoppeld aan een vacature.
                </p>
              ) : (
                appList.map((app: any) => {
                  const currentIdx = stageList.findIndex(
                    (s) => s.id === app.currentStageId
                  );

                  return (
                    <div key={app.id}>
                      <p className="text-xs font-medium text-foreground truncate mb-2">
                        {app.vacancyTitle || "Vacature"}
                      </p>

                      {stageList.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {stageList.map((stage, idx) => {
                            const isDone = currentIdx >= 0 && idx < currentIdx;
                            const isActive = idx === currentIdx;
                            return (
                              <div
                                key={stage.id}
                                className="flex items-center gap-1 flex-1 min-w-0"
                              >
                                <div
                                  title={stage.name}
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                    isDone
                                      ? "border-emerald-500 bg-emerald-500"
                                      : isActive
                                        ? "border-primary bg-primary"
                                        : "border-border bg-transparent"
                                  )}
                                >
                                  {isDone && (
                                    <CheckCircle2 className="h-3 w-3 text-white" />
                                  )}
                                  {isActive && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                                {idx < stageList.length - 1 && (
                                  <div
                                    className={cn(
                                      "h-0.5 flex-1",
                                      isDone
                                        ? "bg-emerald-500"
                                        : "bg-border"
                                    )}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {app.currentStageName && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Huidige stap:{" "}
                          <span className="text-foreground font-medium">
                            {app.currentStageName}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Documenten checklist */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Documenten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => {
                const present = presentDocTypes.has(type);
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span>{DOCUMENT_TYPE_ICONS[type]}</span>
                      <span
                        className={present ? "text-foreground" : "text-muted-foreground"}
                      >
                        {label}
                      </span>
                    </div>
                    {present ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-border" />
                    )}
                  </div>
                );
              })}
              {fileList.length > 0 && (
                <div className="pt-2 border-t border-border/50 mt-2">
                  <p className="text-xs text-muted-foreground">
                    + {fileList.length} bestand{fileList.length !== 1 ? "en" : ""} geüpload
                  </p>
                </div>
              )}
              {documentList.length === 0 && fileList.length === 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  Nog geen documenten.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contactbuttons */}
          <div className="flex flex-col gap-2">
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors ring-1 ring-border/60"
              >
                <Phone className="h-4 w-4" />
                Bellen
              </a>
            )}
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors ring-1 ring-border/60"
              >
                <Mail className="h-4 w-4" />
                E-mailen
              </a>
            )}
          </div>
        </div>
      </div>

      {/* CV Parse Review Modal */}
      {lastUploadedFileId && (
        <CVParseReview
          fileId={lastUploadedFileId}
          open={!!lastUploadedFileId}
          onApply={(_data) => setLastUploadedFileId(null)}
          onClose={() => setLastUploadedFileId(null)}
        />
      )}
    </div>
  );
}
