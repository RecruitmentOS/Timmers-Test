"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useCreateCampaign,
  useUpdateCampaign,
  useTargetingTemplates,
  usePersonaTemplates,
  useMetaStatus,
  useLaunchMetaAd,
} from "@/hooks/use-campaigns";
import type {
  Campaign,
  CampaignChannel,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignFormProps {
  vacancyId: string;
  campaign?: Campaign;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type FormValues = {
  name: string;
  channel: CampaignChannel;
  budgetCents: string;
  startDate: string;
  endDate: string;
  spendCents: string;
  clicks: string;
};

const CHANNELS: { value: CampaignChannel; label: string }[] = [
  { value: "meta", label: "Meta (Facebook/Instagram)" },
  { value: "indeed", label: "Indeed" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "manual", label: "Handmatig" },
];

export function CampaignForm({
  vacancyId,
  campaign,
  trigger,
  onSuccess,
}: CampaignFormProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const { data: metaStatus } = useMetaStatus();
  const { data: targetingTemplates } = useTargetingTemplates();
  const { data: personaTemplates } = usePersonaTemplates(vacancyId);
  const launchMeta = useLaunchMetaAd(campaign?.id ?? "");

  const isEdit = !!campaign;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: campaign?.name ?? "",
      channel: campaign?.channel ?? "manual",
      budgetCents: campaign?.budgetCents
        ? String(campaign.budgetCents / 100)
        : "",
      startDate: campaign?.startDate?.slice(0, 10) ?? "",
      endDate: campaign?.endDate?.slice(0, 10) ?? "",
      spendCents: campaign ? String(campaign.spendCents / 100) : "",
      clicks: campaign ? String(campaign.clicks) : "",
    },
  });

  const selectedChannel = watch("channel");
  const isMetaConnected = !!metaStatus;
  const showMetaTargeting = selectedChannel === "meta" && isMetaConnected;
  const showManualEntry = selectedChannel === "manual" || isEdit;

  const [selectedTargetingId, setSelectedTargetingId] = useState<string>("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  const onSubmit = async (values: FormValues) => {
    if (isEdit && campaign) {
      const data: UpdateCampaignInput = {
        name: values.name,
        budgetCents: values.budgetCents
          ? Math.round(Number(values.budgetCents) * 100)
          : undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        spendCents:
          values.spendCents !== ""
            ? Math.round(Number(values.spendCents) * 100)
            : undefined,
        clicks:
          values.clicks !== "" ? Number(values.clicks) : undefined,
      };
      await updateMutation.mutateAsync({ id: campaign.id, data });
    } else {
      const data: CreateCampaignInput = {
        vacancyId,
        name: values.name,
        channel: values.channel,
        budgetCents: values.budgetCents
          ? Math.round(Number(values.budgetCents) * 100)
          : undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
      };
      const created = await createMutation.mutateAsync(data);

      // Offer Meta launch if applicable
      if (
        values.channel === "meta" &&
        isMetaConnected &&
        created?.id
      ) {
        await launchMeta.mutateAsync();
      }
    }
    setOpen(false);
    reset();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement | undefined) ?? (
            <Button>
              {isEdit ? "Bewerken" : "Nieuwe campagne"}
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Campagne bewerken" : "Nieuwe campagne"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Campagne naam</Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              placeholder="bijv. Indeed C/CE chauffeurs"
            />
          </div>

          {!isEdit && (
            <div>
              <Label htmlFor="channel">Kanaal</Label>
              <Select
                value={selectedChannel}
                onValueChange={(v) =>
                  setValue("channel", (v ?? "manual") as CampaignChannel)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer kanaal" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="budgetCents">Budget (EUR)</Label>
              <Input
                id="budgetCents"
                type="number"
                step="0.01"
                {...register("budgetCents")}
                placeholder="0.00"
              />
            </div>
            <div />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Startdatum</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Einddatum</Label>
              <Input
                id="endDate"
                type="date"
                {...register("endDate")}
              />
            </div>
          </div>

          {showManualEntry && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <Label htmlFor="spendCents">Uitgaven (EUR)</Label>
                <Input
                  id="spendCents"
                  type="number"
                  step="0.01"
                  {...register("spendCents")}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="clicks">Kliks</Label>
                <Input
                  id="clicks"
                  type="number"
                  {...register("clicks")}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {showMetaTargeting && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-medium text-muted-foreground">
                Meta targeting
              </p>
              <div>
                <Label>Targeting template</Label>
                <Select
                  value={selectedTargetingId}
                  onValueChange={(v) => setSelectedTargetingId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targetingTemplates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Persona template</Label>
                <Select
                  value={selectedPersonaId}
                  onValueChange={(v) => setSelectedPersonaId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {(personaTemplates ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Opslaan..."
                : isEdit
                  ? "Opslaan"
                  : "Aanmaken"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
