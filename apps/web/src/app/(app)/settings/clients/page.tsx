"use client";

import Link from "next/link";
import { useMode } from "@/lib/use-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users } from "lucide-react";

export default function ClientsSettingsPage() {
  const mode = useMode();
  const isEmployer = mode === "employer";

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">
        {isEmployer ? "Hiring managers" : "Klanten"}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEmployer ? (
              <Users className="size-5" />
            ) : (
              <Building2 className="size-5" />
            )}
            {isEmployer
              ? "Beheer hiring managers"
              : "Beheer klanten"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isEmployer
              ? "Beheer de hiring managers die toegang hebben tot het portaal en vacatures kunnen bekijken."
              : "Beheer je klanten, hun contactpersonen en vacaturetoewijzingen."}
          </p>
          <Link href={isEmployer ? "/clients" : "/clients"}>
            <Button variant="outline">
              {isEmployer
                ? "Ga naar hiring managers"
                : "Ga naar klantenbeheer"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
