"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { CandidateApplication } from "@recruitment-os/types";

/**
 * CandidateListTable
 *
 * Minimal table with multi-select row selection mirroring the TanStack
 * Table v8 API shape (`rowSelection: Record<string, boolean>`). The
 * master header checkbox toggles CURRENT PAGE ONLY — the
 * "select all matching the filter" flow is handled by
 * `SelectAllMatchingBanner` + `isAllMatchingSelected` in the page.
 *
 * NOTE: We deliberately do not depend on `@tanstack/react-table` yet
 * (not in package.json). The `rowSelection` naming and shape are
 * identical so a future `useReactTable` migration is a drop-in.
 */

type RowSelection = Record<string, boolean>;

type Row = CandidateApplication & {
  candidate?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  vacancy?: { title: string } | null;
  stage?: { name: string } | null;
};

type Props = {
  rows: Row[];
  rowSelection: RowSelection;
  onRowSelectionChange: (
    next: RowSelection | ((prev: RowSelection) => RowSelection)
  ) => void;
  isLoading?: boolean;
};

export function CandidateListTable({
  rows,
  rowSelection,
  onRowSelectionChange,
  isLoading,
}: Props) {
  // useReactTable-like shape — uses master header checkbox for current page.
  const allOnPageChecked =
    rows.length > 0 && rows.every((r) => !!rowSelection[r.id]);
  const someOnPageChecked =
    rows.some((r) => !!rowSelection[r.id]) && !allOnPageChecked;

  function toggleAllOnPage(next: boolean) {
    const draft: RowSelection = { ...rowSelection };
    if (next) {
      for (const r of rows) draft[r.id] = true;
    } else {
      for (const r of rows) delete draft[r.id];
    }
    onRowSelectionChange(draft);
  }

  function toggleRow(id: string, next: boolean) {
    const draft: RowSelection = { ...rowSelection };
    if (next) {
      draft[id] = true;
    } else {
      delete draft[id];
    }
    onRowSelectionChange(draft);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allOnPageChecked}
              indeterminate={someOnPageChecked}
              onCheckedChange={(next) => {
                toggleAllOnPage(next === true);
              }}
              aria-label="Selecteer alle op deze pagina"
            />
          </TableHead>
          <TableHead>Kandidaat</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Vacature</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Kwalificatie</TableHead>
          <TableHead>Bijgewerkt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              Laden…
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              Geen kandidaten gevonden.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => {
            const checked = !!rowSelection[r.id];
            const name = r.candidate
              ? `${r.candidate.firstName ?? ""} ${r.candidate.lastName ?? ""}`.trim()
              : r.candidateId;
            return (
              <TableRow
                key={r.id}
                data-state={checked ? "selected" : undefined}
                className={checked ? "bg-muted/40" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggleRow(r.id, next === true)}
                    aria-label={`Selecteer ${name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.candidate?.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.vacancy?.title ?? r.vacancyId}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.stage?.name ?? r.currentStageId ?? "—"}
                </TableCell>
                <TableCell>
                  <QualificationBadge status={r.qualificationStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(r.updatedAt).toLocaleDateString("nl-NL")}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function QualificationBadge({ status }: { status: CandidateApplication["qualificationStatus"] }) {
  const map = {
    pending: { label: "Open", variant: "secondary" as const },
    yes: { label: "Ja", variant: "default" as const },
    maybe: { label: "Misschien", variant: "outline" as const },
    no: { label: "Nee", variant: "destructive" as const },
  };
  const m = map[status] ?? map.pending;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
