"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useCreateTargetingTemplate } from "@/hooks/use-campaigns";
import type { CreateTargetingTemplateInput } from "@recruitment-os/types";
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
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FormValues = {
  name: string;
  countries: string;
  cityKey: string;
  cityRadius: string;
  dutch: boolean;
  english: boolean;
  interests: string;
};

interface TargetingTemplateFormProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function TargetingTemplateForm({
  trigger,
  onSuccess,
}: TargetingTemplateFormProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateTargetingTemplate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      countries: "NL,BE",
      cityKey: "",
      cityRadius: "25",
      dutch: true,
      english: false,
      interests: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const locales: number[] = [];
    if (values.dutch) locales.push(25); // nl_NL locale code
    if (values.english) locales.push(6); // en_GB locale code

    const data: CreateTargetingTemplateInput = {
      name: values.name,
      targetingSpec: {
        geoLocations: {
          countries: values.countries
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          cities: values.cityKey
            ? [
                {
                  key: values.cityKey,
                  radius: Number(values.cityRadius) || 25,
                  distanceUnit: "kilometer",
                },
              ]
            : undefined,
        },
        locales: locales.length > 0 ? locales : undefined,
        interests: values.interests
          ? values.interests
              .split(",")
              .map((i, idx) => ({
                id: String(idx),
                name: i.trim(),
              }))
              .filter((i) => i.name)
          : undefined,
      },
    };

    await createMutation.mutateAsync(data);
    setOpen(false);
    reset();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement | undefined) ?? (
            <Button variant="outline" size="sm">
              Nieuw targeting template
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Targeting template aanmaken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="tt-name">Naam</Label>
            <Input
              id="tt-name"
              {...register("name", { required: true })}
              placeholder="bijv. Regio Randstad"
            />
          </div>

          <div>
            <Label htmlFor="tt-countries">
              Landen (komma-gescheiden ISO codes)
            </Label>
            <Input
              id="tt-countries"
              {...register("countries")}
              placeholder="NL,BE"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tt-city">Stad (key)</Label>
              <Input
                id="tt-city"
                {...register("cityKey")}
                placeholder="bijv. Amsterdam"
              />
            </div>
            <div>
              <Label htmlFor="tt-radius">Straal (km)</Label>
              <Input
                id="tt-radius"
                type="number"
                {...register("cityRadius")}
                placeholder="25"
              />
            </div>
          </div>

          <div>
            <Label>Talen</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("dutch")} />
                Nederlands
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("english")} />
                Engels
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="tt-interests">
              Interesses (komma-gescheiden)
            </Label>
            <Input
              id="tt-interests"
              {...register("interests")}
              placeholder="transport, logistiek, vrachtwagen"
            />
          </div>

          <TooltipProvider>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 rounded p-2">
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  EU-regelgeving verbiedt leeftijd- en geslachtstargeting voor
                  vacatureadvertenties.
                </TooltipContent>
              </Tooltip>
              <span>
                Leeftijd en geslacht zijn niet beschikbaar voor
                vacatureadvertenties (EU-regelgeving).
              </span>
            </div>
          </TooltipProvider>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Opslaan..." : "Aanmaken"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
