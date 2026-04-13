"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useOrgSettings, useUpdateOrgSettings } from "@/hooks/use-admin";
import { useProductTour } from "@/hooks/use-product-tour";
import { AIUsageSection } from "./ai-usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsForm {
  name: string;
  logo: string;
}

export default function GeneralSettingsPage() {
  const { data: settings, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();
  const { startTour } = useProductTour();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<SettingsForm>();

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name ?? "",
        logo: settings.logo ?? "",
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsForm) => {
    updateSettings.mutate({
      name: data.name || undefined,
      logo: data.logo || null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Algemene instellingen</h2>

      <Card>
        <CardHeader>
          <CardTitle>Organisatie</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                {...register("name", { required: true, minLength: 2 })}
                placeholder="Bedrijfsnaam"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Subdomein</Label>
              <Input
                id="slug"
                value={settings?.slug ?? ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Wordt automatisch bijgewerkt bij naamswijziging
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                {...register("logo")}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Directe link naar het logo van je organisatie
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!isDirty || isSubmitting || updateSettings.isPending}
              >
                {updateSettings.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AIUsageSection />

      <Card>
        <CardHeader>
          <CardTitle>Rondleiding</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Bekijk de rondleiding opnieuw om alle functies te ontdekken.
          </p>
          <Button variant="outline" onClick={() => startTour()}>
            Rondleiding opnieuw starten
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
