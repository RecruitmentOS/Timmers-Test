"use client";

import { useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useApplications } from "@/hooks/use-applications";
import {
  useBulkActionsHandler,
  type BulkActionInput,
} from "@/hooks/use-bulk-actions";
import { CandidateListTable } from "@/components/candidates/candidate-list-table";
import { BulkActionToolbar, type BulkMode } from "@/components/candidates/bulk-action-toolbar";
import { BulkConfirmationModal } from "@/components/candidates/bulk-confirmation-modal";
import { SelectAllMatchingBanner } from "@/components/candidates/select-all-matching-banner";
import { CandidateKanban } from "./components/candidate-kanban";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  LayoutGrid,
  List,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  MapPin,
  Calendar,
  Briefcase,
  Columns3,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useVacancies } from "@/hooks/use-vacancies";
import type { BulkFilter, CandidateApplication } from "@recruitment-os/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type View = "table" | "cards" | "pipeline";
type PipelineStage = { id: string; name: string };
type OrgUser = { id: string; name: string };

function usePipelineStages() {
  return useQuery<PipelineStage[]>({
    queryKey: ["admin", "pipeline-stages"],
    queryFn: () => apiClient<PipelineStage[]>("/api/admin/pipeline-stages"),
  });
}

const QUAL_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  yes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  maybe: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  no: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const QUAL_LABEL: Record<string, string> = {
  pending: "Open",
  yes: "Gekwalificeerd",
  maybe: "Mogelijk",
  no: "Afgewezen",
};

export default function CandidatesPage() {
  const [vacancyId, setVacancyId] = useQueryState("vacancyId");
  const [stageId, setStageId] = useQueryState("stageId");
  const [ownerId, setOwnerId] = useQueryState("ownerId");
  const [source, setSource] = useQueryState("source");
  const [q, setQ] = useQueryState("q");

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [view, setView] = useState<View>("table");

  const filtersForQuery = useMemo(
    () => ({
      vacancyId: vacancyId ?? undefined,
      stageId: stageId ?? undefined,
      ownerId: ownerId ?? undefined,
      source: source ?? undefined,
      page: 1,
      limit: PAGE_SIZE,
    }),
    [vacancyId, stageId, ownerId, source]
  );

  const filterForBulk: BulkFilter = useMemo(
    () => ({
      vacancyId: vacancyId ?? undefined,
      stageId: stageId ?? undefined,
      ownerId: ownerId ?? undefined,
      source: source ?? undefined,
    }),
    [vacancyId, stageId, ownerId, source]
  );

  const { data: response, isLoading } = useApplications(filtersForQuery);
  const { data: stagesData } = usePipelineStages();
  const { data: vacanciesData } = useVacancies();

  const rows = response?.rows ?? [];
  const totalMatching = response?.total ?? 0;
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  const qualYes = rows.filter((r) => r.qualificationStatus === "yes").length;
  const qualNo = rows.filter((r) => r.qualificationStatus === "no").length;
  const qualPending = rows.filter((r) => r.qualificationStatus === "pending").length;

  const availableStages = useMemo(
    () => (stagesData ?? []).map((s) => ({ id: s.id, name: s.name })),
    [stagesData]
  );

  const availableOwners: OrgUser[] = [];

  const { execute: executeBulk, isPending: bulkPending } = useBulkActionsHandler({
    selectedIds,
    filter: filterForBulk,
    isAllMatchingSelected,
  });

  function clearSelection() {
    setRowSelection({});
    setIsAllMatchingSelected(false);
  }

  async function handleConfirm(action: BulkActionInput) {
    try {
      const outcome = await executeBulk(action);
      const updated = outcome.result.updated;
      setToast({ kind: "success", text: `${updated} kandidaten bijgewerkt` });
      setBulkMode(null);
      clearSelection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "onbekende fout";
      setToast({ kind: "error", text: `Bulk actie mislukt: ${msg}` });
    }
  }

  const showBanner =
    !isLoading &&
    selectedCount >= rows.length &&
    rows.length > 0 &&
    totalMatching > rows.length;

  const effectiveCount = isAllMatchingSelected ? totalMatching : selectedCount;

  const hasActiveFilters = !!(vacancyId || stageId || ownerId || source || q);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kandidaten</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overzicht van sollicitaties en hun voortgang
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Totaal"
          value={totalMatching}
          icon={<Users className="h-6 w-6 text-slate-400" />}
        />
        <StatCard
          label="Open"
          value={qualPending}
          icon={<Loader2 className="h-6 w-6 text-amber-500" />}
          note={rows.length < totalMatching ? "zichtbare" : undefined}
        />
        <StatCard
          label="Gekwalificeerd"
          value={qualYes}
          icon={<ThumbsUp className="h-6 w-6 text-emerald-500" />}
          note={rows.length < totalMatching ? "zichtbare" : undefined}
        />
        <StatCard
          label="Afgewezen"
          value={qualNo}
          icon={<ThumbsDown className="h-6 w-6 text-red-400" />}
          note={rows.length < totalMatching ? "zichtbare" : undefined}
        />
      </div>

      {/* Filter bar + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 max-w-72 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam…"
            value={q ?? ""}
            onChange={(e) => setQ(e.target.value || null)}
            className="pl-8"
          />
        </div>

        <Select
          value={vacancyId ?? "all"}
          onValueChange={(v) =>
            setVacancyId(((v as string) ?? "all") === "all" ? null : (v as string))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alle vacatures" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle vacatures</SelectItem>
            {(vacanciesData ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stageId ?? "all"}
          onValueChange={(v) =>
            setStageId(((v as string) ?? "all") === "all" ? null : (v as string))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Alle stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle stages</SelectItem>
            {availableStages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={source ?? "all"}
          onValueChange={(v) =>
            setSource(((v as string) ?? "all") === "all" ? null : (v as string))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Alle bronnen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle bronnen</SelectItem>
            <SelectItem value="indeed">Indeed</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setVacancyId(null);
              setStageId(null);
              setOwnerId(null);
              setSource(null);
              setQ(null);
            }}
          >
            Filters wissen
          </Button>
        )}

        <div className="ml-auto flex rounded-full border bg-muted p-0.5">
          {(["table", "cards", "pipeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-all",
                view === v
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "table" && <List className="h-3.5 w-3.5" />}
              {v === "cards" && <LayoutGrid className="h-3.5 w-3.5" />}
              {v === "pipeline" && <Columns3 className="h-3.5 w-3.5" />}
              {v === "table" ? "Tabel" : v === "cards" ? "Kaarten" : "Pijplijn"}
            </button>
          ))}
        </div>
      </div>

      {/* Select-all-matching banner */}
      {showBanner && (
        <SelectAllMatchingBanner
          pageSize={rows.length}
          totalMatching={totalMatching}
          isAllMatchingSelected={isAllMatchingSelected}
          onSelectAllMatching={() => setIsAllMatchingSelected(true)}
          onClearSelection={clearSelection}
        />
      )}

      {/* Empty state */}
      {!isLoading && rows.length === 0 && (
        <EmptyState
          icon={<Users />}
          title="Nog geen kandidaten"
          description="Kandidaten verschijnen hier zodra ze solliciteren of worden toegevoegd"
        />
      )}

      {/* Content */}
      {view === "pipeline" ? (
        isLoading && rows.length === 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 w-72 min-w-[272px] animate-pulse rounded-xl border bg-muted" />
            ))}
          </div>
        ) : (
          <CandidateKanban stages={availableStages} rows={rows} />
        )
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && rows.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-xl border bg-muted ring-1 ring-border/40"
                />
              ))
            : rows.map((r) => <CandidateCard key={r.id} row={r} />)}
        </div>
      ) : (
        <CandidateListTable
          rows={rows}
          rowSelection={rowSelection}
          onRowSelectionChange={(next) => {
            setIsAllMatchingSelected(false);
            setRowSelection(typeof next === "function" ? next(rowSelection) : next);
          }}
          isLoading={isLoading}
        />
      )}

      {/* Sticky bulk toolbar (table view only) */}
      {view === "table" && (
        <BulkActionToolbar
          selectedCount={selectedCount}
          isAllMatchingSelected={isAllMatchingSelected}
          totalMatching={totalMatching}
          onOpenMode={(mode) => setBulkMode(mode)}
          onClearSelection={clearSelection}
        />
      )}

      <BulkConfirmationModal
        open={bulkMode !== null}
        mode={bulkMode}
        count={effectiveCount}
        availableStages={availableStages}
        availableOwners={availableOwners}
        onConfirm={handleConfirm}
        onCancel={() => setBulkMode(null)}
      />

      {toast && (
        <div
          className={cn(
            "fixed right-6 top-6 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg cursor-pointer",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
          onClick={() => setToast(null)}
        >
          {toast.text}
        </div>
      )}

      {bulkPending && (
        <div className="fixed right-6 bottom-24 z-40 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow">
          Bulk actie wordt uitgevoerd…
        </div>
      )}
    </div>
  );
}

type Row = CandidateApplication & {
  candidate?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  vacancy?: { title: string } | null;
  stage?: { name: string } | null;
};

function CandidateCard({ row: r }: { row: Row }) {
  const firstName = r.candidate?.firstName ?? "";
  const lastName = r.candidate?.lastName ?? "";
  const name = `${firstName} ${lastName}`.trim() || "Onbekend";
  const initials = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?";
  const email = r.candidate?.email;
  const qual = r.qualificationStatus ?? "pending";

  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-5 shadow-sm ring-1 ring-border/60 dark:ring-border/40 transition-shadow hover:shadow-md">
      {/* Avatar + status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
          {initials}
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            QUAL_STYLES[qual]
          )}
        >
          {QUAL_LABEL[qual]}
        </span>
      </div>

      {/* Name + email */}
      <p className="font-semibold text-foreground leading-snug">{name}</p>
      {email && (
        <p className="mt-0.5 text-sm text-muted-foreground truncate">{email}</p>
      )}

      {/* Meta */}
      <div className="mt-3 space-y-1.5">
        {r.vacancy?.title && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            {r.vacancy.title}
          </p>
        )}
        {r.stage?.name && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {r.stage.name}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(r.updatedAt).toLocaleDateString("nl-NL")}
        </span>
        {r.sourceDetail && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {r.sourceDetail}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm ring-1 ring-border/60 dark:ring-border/40">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {note && <p className="text-xs text-muted-foreground/60 mt-0.5">{note}</p>}
    </div>
  );
}
