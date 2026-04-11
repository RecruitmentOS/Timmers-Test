"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCampaigns, useCampaignMetrics } from "@/hooks/use-campaigns";
import type { Campaign } from "@recruitment-os/types";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function MetricsSummary({ campaignId }: { campaignId: string }) {
  const { data: metrics, isLoading } = useCampaignMetrics(campaignId);

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!metrics) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(v / 100);

  return (
    <div className="grid grid-cols-4 gap-3 mt-4">
      <Card>
        <CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Uitgaven</p>
          <p className="text-lg font-semibold">{fmt(metrics.spend)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Kliks</p>
          <p className="text-lg font-semibold">{metrics.clicks}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Sollicitaties</p>
          <p className="text-lg font-semibold">{metrics.applications}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">CPH</p>
          <p className="text-lg font-semibold">
            {metrics.costPerHire != null ? fmt(metrics.costPerHire) : "-"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VacancyCampaignsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaigns, isLoading } = useCampaigns(id);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campagnes</h2>
        <CampaignForm vacancyId={id} />
      </div>

      <CampaignList
        campaigns={campaigns ?? []}
        vacancyId={id}
        onSelect={setSelectedCampaign}
        selectedId={selectedCampaign?.id}
      />

      {selectedCampaign && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedCampaign.name} - Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsSummary campaignId={selectedCampaign.id} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
