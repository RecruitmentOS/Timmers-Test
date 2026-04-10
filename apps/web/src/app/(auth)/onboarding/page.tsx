"use client";

import { useState, useMemo } from "react";
import { useCreateOrganization, useCheckSlug } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "agency" | "employer";

const USER_COUNT_OPTIONS = [
  { label: "1-3", value: 2 },
  { label: "4-10", value: 7 },
  { label: "11-25", value: 18 },
  { label: "25+", value: 30 },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [expectedUserCount, setExpectedUserCount] = useState<number | null>(null);

  const createOrg = useCreateOrganization();

  const slug = useMemo(() => slugify(orgName), [orgName]);
  const slugCheck = useCheckSlug(slug);

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return orgName.trim().length >= 2;
      case 2:
        return mode !== null;
      case 3:
        return primaryLocation.trim().length >= 1 && expectedUserCount !== null;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    if (!mode || !expectedUserCount) return;
    createOrg.mutate({
      orgName: orgName.trim(),
      mode,
      primaryLocation: primaryLocation.trim(),
      expectedUserCount,
    });
  };

  return (
    <Card className="w-full max-w-lg shadow-sm">
      <CardHeader className="p-8 pb-4">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-1">Stap {step} van 4</p>
        <CardTitle className="text-xl font-semibold">
          {step === 1 && "Organisatienaam"}
          {step === 2 && "Modus kiezen"}
          {step === 3 && "Details"}
          {step === 4 && "Klaar!"}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-8 pt-2">
        {/* Step 1: Organization name */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-sm text-gray-700">
                Naam van je organisatie
              </Label>
              <Input
                id="orgName"
                type="text"
                placeholder="Bijv. Simon Loos of Upply Jobs"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoFocus
              />
            </div>
            {slug && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">
                  Jouw subdomain:{" "}
                  <span className="font-mono text-gray-900">
                    {slug}.recruitment-os.nl
                  </span>
                </span>
                {slugCheck.isLoading && (
                  <span className="text-gray-400 text-xs">controleren...</span>
                )}
                {slugCheck.data?.available === true && (
                  <span className="text-green-600 text-lg" title="Beschikbaar">
                    &#10003;
                  </span>
                )}
                {slugCheck.data?.available === false && (
                  <span className="text-red-600 text-lg" title="Niet beschikbaar">
                    &#10007;
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Mode selection */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Hoe wil je Recruitment OS gebruiken?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMode("employer")}
                className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-colors text-center ${
                  mode === "employer"
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Werkgever</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Je werft zelf chauffeurs
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("agency")}
                className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-colors text-center ${
                  mode === "agency"
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-purple-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Uitzendbureau</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Je plaatst chauffeurs bij klanten
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm text-gray-700">
                Primaire locatie
              </Label>
              <Input
                id="location"
                type="text"
                placeholder="Bijv. Amsterdam, Rotterdam, Breda"
                value={primaryLocation}
                onChange={(e) => setPrimaryLocation(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-700">
                Verwacht aantal gebruikers
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {USER_COUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpectedUserCount(opt.value)}
                    className={`py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                      expectedUserCount === opt.value
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Controleer je gegevens en maak je organisatie aan.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Organisatie</span>
                <span className="font-medium text-gray-900">{orgName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subdomain</span>
                <span className="font-mono text-gray-900">
                  {slug}.recruitment-os.nl
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Modus</span>
                <span className="font-medium text-gray-900">
                  {mode === "employer" ? "Werkgever" : "Uitzendbureau"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Locatie</span>
                <span className="font-medium text-gray-900">
                  {primaryLocation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Gebruikers</span>
                <span className="font-medium text-gray-900">
                  {USER_COUNT_OPTIONS.find((o) => o.value === expectedUserCount)
                    ?.label ?? "-"}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-medium mb-1">Wat wordt aangemaakt:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  {mode === "agency" ? "10" : "9"} pipeline-stappen
                  {mode === "agency" && " (incl. 'Sent to client')"}
                </li>
                <li>Transport kwalificatie-presets (Chauffeur CE, Chauffeur C)</li>
                <li>14 dagen gratis proefperiode</li>
              </ul>
            </div>

            {createOrg.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {createOrg.error.message}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              Vorige
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Volgende
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createOrg.isPending}
            >
              {createOrg.isPending
                ? "Bezig met aanmaken..."
                : "Organisatie aanmaken"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
