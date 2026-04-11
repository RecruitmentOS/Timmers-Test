"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { Campaign, CampaignChannel, CampaignStatus } from "@recruitment-os/types";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignDashboard } from "@/components/campaigns/campaign-dashboard";
import { AttributionTable } from "@/components/campaigns/attribution-table";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle kanalen" },
  { value: "meta", label: "Meta" },
  { value: "indeed", label: "Indeed" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "manual", label: "Handmatig" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle statussen" },
  { value: "draft", label: "Concept" },
  { value: "active", label: "Actief" },
  { value: "paused", label: "Gepauzeerd" },
  { value: "completed", label: "Afgerond" },
];

export default function CampaignsPage() {
  const { data: allCampaigns, isLoading } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );

  // URL-state filters
  const [channelFilter, setChannelFilter] = useQueryState("channel", {
    defaultValue: "all",
  });
  const [statusFilter, setStatusFilter] = useQueryState("status", {
    defaultValue: "all",
  });
  const [vacancyFilter, setVacancyFilter] = useQueryState("vacancy", {
    defaultValue: "",
  });

  const campaigns = (allCampaigns ?? []).filter((c) => {
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (vacancyFilter && c.vacancyId !== vacancyFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campagnes</h1>
        <CampaignForm vacancyId="" />
      </div>

      <div className="grid grid-cols-[350px_1fr] gap-6">
        {/* Left panel - campaign list with filters */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Kanaal</Label>
              <Select
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v as string)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as string)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Laden...</p>
              ) : (
                <CampaignList
                  campaigns={campaigns}
                  vacancyId=""
                  onSelect={setSelectedCampaign}
                  selectedId={selectedCampaign?.id}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel - dashboard + attribution */}
        <div className="space-y-6">
          {selectedCampaign ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedCampaign.name}
                </h2>
                <CampaignForm
                  vacancyId={selectedCampaign.vacancyId}
                  campaign={selectedCampaign}
                  trigger={
                    <button className="text-sm text-indigo-600 hover:underline">
                      Bewerken
                    </button>
                  }
                />
              </div>

              <CampaignDashboard campaignId={selectedCampaign.id} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Gekoppelde sollicitaties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AttributionTable campaignId={selectedCampaign.id} />
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Selecteer een campagne om het dashboard te bekijken</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
