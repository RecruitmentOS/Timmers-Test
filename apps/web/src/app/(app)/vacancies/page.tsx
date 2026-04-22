"use client";

import { useState } from "react";
import Link from "next/link";
import { useVacancies, useArchiveVacancy, useUnarchiveVacancy } from "@/hooks/use-vacancies";
import type { Vacancy } from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MapPin,
  Briefcase,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  List,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  active: "Actief",
  paused: "Gepauzeerd",
  closed: "Gesloten",
  archived: "Gearchiveerd",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  closed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  archived: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

type View = "table" | "cards";

export default function VacanciesPage() {
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<View>("table");
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const filters: Record<string, string> = {};
  if (status && status !== "all") filters.status = status;
  if (location) filters.location = location;
  if (search) filters.search = search;
  if (showArchived) filters.includeArchived = "true";

  const { data: vacancies, isLoading } = useVacancies(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  const { data: allVacancies } = useVacancies();

  const archiveMutation = useArchiveVacancy();
  const unarchiveMutation = useUnarchiveVacancy();

  const total = allVacancies?.length ?? 0;
  const active = allVacancies?.filter((v) => v.status === "active").length ?? 0;
  const paused = allVacancies?.filter((v) => v.status === "paused").length ?? 0;
  const closed = allVacancies?.filter((v) => v.status === "closed").length ?? 0;

  function showToast(kind: "success" | "error", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  }

  const handleArchive = (id: string) =>
    archiveMutation.mutate(id, {
      onSuccess: () => showToast("success", "Vacature gearchiveerd"),
      onError: () => showToast("error", "Archiveren mislukt"),
    });

  const handleUnarchive = (id: string) =>
    unarchiveMutation.mutate(id, {
      onSuccess: () => showToast("success", "Vacature hersteld naar concept"),
      onError: () => showToast("error", "Herstellen mislukt"),
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vacatures</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Beheer openstaande functies en volg de invulling
          </p>
        </div>
        <Link href="/vacancies/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Vacature aanmaken
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Totaal"
          value={total}
          icon={<Briefcase className="h-6 w-6 text-slate-400" />}
        />
        <StatCard
          label="Actief"
          value={active}
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
        />
        <StatCard
          label="Gepauzeerd"
          value={paused}
          icon={<PauseCircle className="h-6 w-6 text-amber-500" />}
        />
        <StatCard
          label="Gesloten"
          value={closed}
          icon={<XCircle className="h-6 w-6 text-red-400" />}
        />
      </div>

      {/* Filter bar + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-80">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op titel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus((v as string) ?? "")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Alle statussen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="draft">Concept</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="paused">Gepauzeerd</SelectItem>
            <SelectItem value="closed">Gesloten</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Locatie..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-40"
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(c) => setShowArchived(c === true)}
          />
          Gearchiveerd tonen
        </label>

        <div className="ml-auto flex rounded-full border bg-muted p-0.5">
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-all",
              view === "table"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
            Tabel
          </button>
          <button
            onClick={() => setView("cards")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-all",
              view === "cards"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kaarten
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "rounded-md px-4 py-2 text-sm border",
            toast.kind === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          )}
        >
          {toast.text}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSkeletons view={view} />
      ) : !vacancies?.length ? (
        <EmptyState
          icon={<Briefcase />}
          title="Nog geen vacatures"
          description="Maak je eerste vacature aan om kandidaten te werven"
          action={{
            label: "Vacature aanmaken",
            onClick: () => (window.location.href = "/vacancies/new"),
          }}
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => (
            <VacancyCard
              key={v.id}
              vacancy={v}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
            />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vacature</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Locatie</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Aangemaakt</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacancies.map((v) => (
              <TableRow key={v.id} className={v.status === "archived" ? "opacity-50" : ""}>
                <TableCell>
                  <Link href={`/vacancies/${v.id}`} className="font-medium hover:underline">
                    {v.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[v.status]
                    )}
                  >
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {v.location ? (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <MapPin className="h-3 w-3" />
                      {v.location}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {v.employmentType || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {new Date(v.createdAt).toLocaleDateString("nl-NL")}
                </TableCell>
                <TableCell>
                  <VacancyActionMenu
                    vacancy={v}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm ring-1 ring-border/60 dark:ring-border/40">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function VacancyCard({
  vacancy: v,
  onArchive,
  onUnarchive,
}: {
  vacancy: Vacancy;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card/60 backdrop-blur-sm p-5 shadow-sm ring-1 ring-border/60 dark:ring-border/40 transition-shadow hover:shadow-md",
        v.status === "archived" && "opacity-60"
      )}
    >
      {/* Status badge + menu */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_STYLES[v.status]
            )}
          >
            {STATUS_LABEL[v.status] ?? v.status}
          </span>
          <VacancyActionMenu vacancy={v} onArchive={onArchive} onUnarchive={onUnarchive} />
        </div>
      </div>

      {/* Title */}
      <Link href={`/vacancies/${v.id}`}>
        <h3 className="font-semibold text-foreground hover:underline leading-snug">
          {v.title}
        </h3>
      </Link>

      {/* Meta */}
      <div className="mt-3 space-y-1.5">
        {v.location && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {v.location}
          </p>
        )}
        {v.employmentType && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            {v.employmentType}
          </p>
        )}
        {v.requiredLicenses && v.requiredLicenses.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {v.requiredLicenses.map((lic) => (
              <span
                key={lic}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {lic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(v.createdAt).toLocaleDateString("nl-NL")}
        </span>
        {v.hourlyRate && (
          <span className="text-xs font-medium text-foreground">
            €{v.hourlyRate}/u
          </span>
        )}
      </div>
    </div>
  );
}

function VacancyActionMenu({
  vacancy: v,
  onArchive,
  onUnarchive,
}: {
  vacancy: Vacancy;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {v.status === "archived" ? (
          <DropdownMenuItem onSelect={() => onUnarchive(v.id)}>
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Herstellen
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onArchive(v.id)}>
            <Archive className="mr-2 h-4 w-4" />
            Archiveren
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoadingSkeletons({ view }: { view: View }) {
  if (view === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
