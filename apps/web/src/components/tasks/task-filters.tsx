"use client";

import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * TaskFilters
 *
 * URL-bound filter controls via nuqs `useQueryState`. Keys match the
 * @recruitment-os/types TaskFilters shape — in particular `assignedTo`
 * (NOT `assignedToUserId`) and `status` defaulting to "open".
 *
 * "Alleen overdue" is a derived toggle in the parent page (it sets
 * `dueBefore` to now() without a separate backend flag).
 */

type Props = {
  users: { id: string; name: string }[];
  vacancies: { id: string; title: string }[];
};

export function TaskFilters({ users, vacancies }: Props) {
  const [assignedTo, setAssignedTo] = useQueryState("assignedTo");
  const [status, setStatus] = useQueryState("status");
  const [vacancyId, setVacancyId] = useQueryState("vacancyId");
  const [dueBefore, setDueBefore] = useQueryState("dueBefore");
  const [dueAfter, setDueAfter] = useQueryState("dueAfter");

  function reset() {
    setAssignedTo(null);
    setStatus(null);
    setVacancyId(null);
    setDueBefore(null);
    setDueAfter(null);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="tf-assigned">Toegewezen aan</Label>
        <Select
          value={assignedTo ?? "all"}
          onValueChange={(v) => {
            const next = (v as string) ?? "all";
            setAssignedTo(next === "all" ? null : next);
          }}
        >
          <SelectTrigger id="tf-assigned" className="w-48">
            <SelectValue placeholder="Iedereen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Iedereen</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="tf-status">Status</Label>
        <Select
          value={status ?? "open"}
          onValueChange={(v) => {
            const next = (v as string) ?? "open";
            setStatus(next === "open" ? null : next);
          }}
        >
          <SelectTrigger id="tf-status" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="completed">Voltooid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="tf-vacancy">Vacature</Label>
        <Select
          value={vacancyId ?? "all"}
          onValueChange={(v) => {
            const next = (v as string) ?? "all";
            setVacancyId(next === "all" ? null : next);
          }}
        >
          <SelectTrigger id="tf-vacancy" className="w-48">
            <SelectValue placeholder="Alle vacatures" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle vacatures</SelectItem>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="tf-due-before">Deadline voor</Label>
        <Input
          id="tf-due-before"
          type="date"
          className="w-40"
          value={dueBefore ?? ""}
          onChange={(e) => setDueBefore(e.target.value || null)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="tf-due-after">Deadline na</Label>
        <Input
          id="tf-due-after"
          type="date"
          className="w-40"
          value={dueAfter ?? ""}
          onChange={(e) => setDueAfter(e.target.value || null)}
        />
      </div>

      {(assignedTo || status || vacancyId || dueBefore || dueAfter) && (
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}
