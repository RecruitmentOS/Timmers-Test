"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useCreatePersonaTemplate,
  useTargetingTemplates,
} from "@/hooks/use-campaigns";
import type { CreatePersonaTemplateInput } from "@recruitment-os/types";
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

const LICENSE_TYPES = ["B", "C", "CE", "D"] as const;

type FormValues = {
  name: string;
  minExperienceYears: string;
  licenseB: boolean;
  licenseC: boolean;
  licenseCE: boolean;
  licenseD: boolean;
  code95: boolean;
  adr: boolean;
  languageNl: boolean;
  languageEn: boolean;
};

interface PersonaTemplateFormProps {
  vacancyId?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function PersonaTemplateForm({
  vacancyId,
  trigger,
  onSuccess,
}: PersonaTemplateFormProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreatePersonaTemplate();
  const { data: targetingTemplates } = useTargetingTemplates();
  const [selectedTargetingId, setSelectedTargetingId] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      minExperienceYears: "",
      licenseB: false,
      licenseC: false,
      licenseCE: false,
      licenseD: false,
      code95: false,
      adr: false,
      languageNl: true,
      languageEn: false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    const requiredLicenses: string[] = [];
    if (values.licenseB) requiredLicenses.push("B");
    if (values.licenseC) requiredLicenses.push("C");
    if (values.licenseCE) requiredLicenses.push("CE");
    if (values.licenseD) requiredLicenses.push("D");

    const languages: string[] = [];
    if (values.languageNl) languages.push("nl");
    if (values.languageEn) languages.push("en");

    const data: CreatePersonaTemplateInput = {
      name: values.name,
      vacancyId: vacancyId || undefined,
      candidateCriteria: {
        minExperienceYears: values.minExperienceYears
          ? Number(values.minExperienceYears)
          : undefined,
        requiredLicenses,
        code95: values.code95,
        adr: values.adr,
        languages,
      },
      targetingTemplateId: selectedTargetingId || undefined,
    };

    await createMutation.mutateAsync(data);
    setOpen(false);
    reset();
    setSelectedTargetingId("");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              Nieuw persona template
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Persona template aanmaken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="pt-name">Naam</Label>
            <Input
              id="pt-name"
              {...register("name", { required: true })}
              placeholder="bijv. CE chauffeur ervaren"
            />
          </div>

          <div>
            <Label htmlFor="pt-exp">Minimale ervaring (jaren)</Label>
            <Input
              id="pt-exp"
              type="number"
              {...register("minExperienceYears")}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Rijbewijzen</Label>
            <div className="flex flex-wrap gap-4 mt-1">
              {LICENSE_TYPES.map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register(`license${l}` as keyof FormValues)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("code95")} />
              Code 95
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("adr")} />
              ADR
            </label>
          </div>

          <div>
            <Label>Taalvereisten</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("languageNl")} />
                Nederlands
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("languageEn")} />
                Engels
              </label>
            </div>
          </div>

          <div>
            <Label>Targeting template koppeling</Label>
            <Select
              value={selectedTargetingId}
              onValueChange={setSelectedTargetingId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer template (optioneel)" />
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
