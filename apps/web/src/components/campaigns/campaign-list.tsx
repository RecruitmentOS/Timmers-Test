"use client";

import type { Campaign } from "@recruitment-os/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignForm } from "./campaign-form";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
};

const CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta",
  indeed: "Indeed",
  google: "Google",
  linkedin: "LinkedIn",
  manual: "Handmatig",
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface CampaignListProps {
  campaigns: Campaign[];
  vacancyId: string;
  onSelect?: (campaign: Campaign) => void;
  selectedId?: string;
}

export function CampaignList({
  campaigns,
  vacancyId,
  onSelect,
  selectedId,
}: CampaignListProps) {
  if (!campaigns.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Geen campagnes</p>
        <CampaignForm vacancyId={vacancyId} />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Naam</TableHead>
          <TableHead>Kanaal</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Uitgaven</TableHead>
          <TableHead className="text-right">Sollicitaties</TableHead>
          <TableHead className="text-right">CPH</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow
            key={c.id}
            className={`cursor-pointer hover:bg-slate-50 ${
              selectedId === c.id ? "bg-slate-50" : ""
            }`}
            onClick={() => onSelect?.(c)}
          >
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell>{CHANNEL_LABELS[c.channel] ?? c.channel}</TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={STATUS_COLORS[c.status] ?? ""}
              >
                {c.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {c.budgetCents ? formatEur(c.budgetCents) : "-"}
            </TableCell>
            <TableCell className="text-right">
              {formatEur(c.spendCents)}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
