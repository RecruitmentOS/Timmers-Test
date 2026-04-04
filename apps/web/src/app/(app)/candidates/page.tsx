"use client";

import { useState } from "react";
import Link from "next/link";
import { useCandidates } from "@/hooks/use-candidates";
import type { Candidate } from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search } from "lucide-react";

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");

  const filters: Record<string, string> = {};
  if (search) filters.search = search;
  if (source && source !== "all") filters.source = source;

  const { data: candidates, isLoading } = useCandidates(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <Link href="/candidates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Candidate
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource((v as string) ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="indeed">Indeed</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !candidates?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No candidates found</p>
          <p className="mt-1">Add your first candidate to get started.</p>
          <Link href="/candidates/new" className="mt-4 inline-block">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((c: Candidate) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/candidates/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.email || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.phone || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.city || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.source || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
