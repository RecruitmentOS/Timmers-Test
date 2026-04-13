"use client";

import { useState } from "react";
import Link from "next/link";
import { useVacancies } from "@/hooks/use-vacancies";
import type { Vacancy } from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Briefcase } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  closed: "bg-red-100 text-red-800",
};

export default function VacanciesPage() {
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");

  const filters: Record<string, string> = {};
  if (status && status !== "all") filters.status = status;
  if (location) filters.location = location;
  if (search) filters.search = search;

  const { data: vacancies, isLoading } = useVacancies(
    Object.keys(filters).length > 0 ? filters : undefined
  );

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

      <div className="flex flex-wrap gap-3">
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
      </div>

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacancies.map((v: Vacancy) => (
              <TableRow key={v.id}>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
