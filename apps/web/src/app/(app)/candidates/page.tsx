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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useVacancies } from "@/hooks/use-vacancies";
import type { BulkFilter } from "@recruitment-os/types";

const PAGE_SIZE = 50;

type PipelineStage = { id: string; name: string };
type OrgUser = { id: string; name: string };

function usePipelineStages() {
  return useQuery<PipelineStage[]>({
    queryKey: ["admin", "pipeline-stages"],
    queryFn: () => apiClient<PipelineStage[]>("/api/admin/pipeline-stages"),
  });
}

export default function CandidatesPage() {
  // URL-bound filter state via nuqs (useQueryState) — shareable filtered views.
  const [vacancyId, setVacancyId] = useQueryState("vacancyId");
  const [stageId, setStageId] = useQueryState("stageId");
  const [ownerId, setOwnerId] = useQueryState("ownerId");
  const [source, setSource] = useQueryState("source");
  const [q, setQ] = useQueryState("q");

  // Row selection: Record<string, boolean> — mirrors TanStack Table shape.
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);

  // Confirmation modal state.
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);

  // Ephemeral toast state (no sonner dependency — keep minimal).
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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

  const availableStages = useMemo(
    () =>
      (stagesData ?? []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    [stagesData]
  );

  // No /api/users endpoint yet — placeholder list. When users endpoint lands,
  // swap to a real query. Keeping an empty array is safe — the assign modal
  // shows "Geen eigenaren beschikbaar" and disables Uitvoeren.
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

  const showBanner = !isLoading && selectedCount >= rows.length && rows.length > 0 && totalMatching > rows.length;
  const effectiveCount = isAllMatchingSelected ? totalMatching : selectedCount;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kandidaten</h1>
      </div>

      {/* Filter bar — all URL-bound via nuqs */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam…"
            value={q ?? ""}
            onChange={(e) => setQ(e.target.value || null)}
            className="pl-10"
          />
        </div>

        <Select
          value={vacancyId ?? "all"}
          onValueChange={(v) => setVacancyId(((v as string) ?? "all") === "all" ? null : (v as string))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Vacature" />
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
          onValueChange={(v) => setStageId(((v as string) ?? "all") === "all" ? null : (v as string))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Stage" />
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
          onValueChange={(v) => setSource(((v as string) ?? "all") === "all" ? null : (v as string))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Bron" />
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

        {(vacancyId || stageId || ownerId || source || q) && (
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
            Reset filters
          </Button>
        )}
      </div>

      {/* Select-all-matching banner: only when every row on the page is selected. */}
      {showBanner && (
        <SelectAllMatchingBanner
          pageSize={rows.length}
          totalMatching={totalMatching}
          isAllMatchingSelected={isAllMatchingSelected}
          onSelectAllMatching={() => setIsAllMatchingSelected(true)}
          onClearSelection={clearSelection}
        />
      )}

      {/* Table with row selection — TanStack-Table shape so a future
          useReactTable migration is a drop-in */}
      <CandidateListTable
        rows={rows}
        rowSelection={rowSelection}
        onRowSelectionChange={(next) => {
          // Any manual row change implicitly exits "all matching" mode.
          setIsAllMatchingSelected(false);
          setRowSelection(typeof next === "function" ? next(rowSelection) : next);
        }}
        isLoading={isLoading}
      />

      {/* Sticky floating bulk toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        isAllMatchingSelected={isAllMatchingSelected}
        totalMatching={totalMatching}
        onOpenMode={(mode) => setBulkMode(mode)}
        onClearSelection={clearSelection}
      />

      {/* Confirmation modal — rendered once, driven by bulkMode */}
      <BulkConfirmationModal
        open={bulkMode !== null}
        mode={bulkMode}
        count={effectiveCount}
        availableStages={availableStages}
        availableOwners={availableOwners}
        onConfirm={handleConfirm}
        onCancel={() => setBulkMode(null)}
      />

      {/* Minimal inline toast (no sonner dependency yet) */}
      {toast && (
        <div
          className={
            "fixed right-6 top-6 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg " +
            (toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-destructive/30 bg-destructive/10 text-destructive")
          }
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
