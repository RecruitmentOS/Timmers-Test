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
import { Plus, MapPin, Briefcase, MoreHorizontal, Archive, ArchiveRestore } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  closed: "bg-red-100 text-red-800",
  archived: "bg-slate-100 text-slate-500",
};

export default function VacanciesPage() {
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const filters: Record<string, string> = {};
  if (status && status !== "all") filters.status = status;
  if (location) filters.location = location;
  if (search) filters.search = search;
  if (showArchived) filters.includeArchived = "true";

  const { data: vacancies, isLoading } = useVacancies(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  const archiveMutation = useArchiveVacancy();
  const unarchiveMutation = useUnarchiveVacancy();

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id, {
      onSuccess: () => {
        setToast({ kind: "success", text: "Vacature gearchiveerd" });
        setTimeout(() => setToast(null), 3000);
      },
      onError: () => {
        setToast({ kind: "error", text: "Archiveren mislukt" });
        setTimeout(() => setToast(null), 3000);
      },
    });
  };

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate(id, {
      onSuccess: () => {
        setToast({ kind: "success", text: "Vacature hersteld naar concept" });
        setTimeout(() => setToast(null), 3000);
      },
      onError: () => {
        setToast({ kind: "error", text: "Herstellen mislukt" });
        setTimeout(() => setToast(null), 3000);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vacancies</h1>
        <Link href="/vacancies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Vacancy
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={status} onValueChange={(v) => setStatus((v as string) ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-48"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          Show archived
        </label>
      </div>

      {/* Inline toast */}
      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            toast.kind === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.text}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Location</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacancies.map((v: Vacancy) => (
              <TableRow
                key={v.id}
                className={v.status === "archived" ? "opacity-60" : ""}
              >
                <TableCell>
                  <Link
                    href={`/vacancies/${v.id}`}
                    className="font-medium hover:underline"
                  >
                    {v.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[v.status] || ""}
                  >
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {v.location && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {v.location}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {v.employmentType || "-"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {new Date(v.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {v.status === "archived" ? (
                        <DropdownMenuItem onSelect={() => handleUnarchive(v.id)}>
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                          Unarchive
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => handleArchive(v.id)}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
