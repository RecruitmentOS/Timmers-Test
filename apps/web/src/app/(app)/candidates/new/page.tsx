"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCreateCandidate } from "@/hooks/use-candidates";
import type { CreateCandidateInput } from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function NewCandidatePage() {
  const router = useRouter();
  const createMutation = useCreateCandidate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCandidateInput>();

  const availabilityType = watch("availabilityType");

  const onSubmit = async (data: CreateCandidateInput) => {
    // Pre-fill today's date for "direct" if no start date specified
    if (data.availabilityType === "direct" && !data.availabilityStartDate) {
      data.availabilityStartDate = new Date().toISOString().split("T")[0];
    }
    const result = await createMutation.mutateAsync(data);
    router.push(`/candidates/${result.id}`);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">New Candidate</h1>

      <Card>
        <CardHeader>
          <CardTitle>Candidate Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...register("firstName", {
                    required: "First name is required",
                  })}
                  placeholder="e.g. Pieter"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...register("lastName", {
                    required: "Last name is required",
                  })}
                  placeholder="e.g. Jansen"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="+31612345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="e.g. Amsterdam"
                />
              </div>

              <div className="space-y-2">
                <Label>Source</Label>
                <Select onValueChange={(val) => val && setValue("source", val as string)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indeed">Indeed</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Transport Details: Beschikbaarheid & Contract */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Beschikbaarheid & Contract
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Beschikbaarheid</Label>
                  <Select
                    onValueChange={(val) =>
                      val && setValue("availabilityType", val as CreateCandidateInput["availabilityType"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer beschikbaarheid" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct beschikbaar</SelectItem>
                      <SelectItem value="opzegtermijn">Opzegtermijn</SelectItem>
                      <SelectItem value="in_overleg">In overleg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availabilityStartDate">Start datum</Label>
                  <Input
                    id="availabilityStartDate"
                    type="date"
                    {...register("availabilityStartDate")}
                    defaultValue={
                      availabilityType === "direct"
                        ? new Date().toISOString().split("T")[0]
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Contract type</Label>
                  <Select
                    onValueChange={(val) =>
                      val && setValue("contractType", val as CreateCandidateInput["contractType"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vast">Vast dienstverband</SelectItem>
                      <SelectItem value="tijdelijk">Tijdelijk contract</SelectItem>
                      <SelectItem value="uitzend">Uitzendovereenkomst</SelectItem>
                      <SelectItem value="zzp">ZZP / Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Candidate"}
              </Button>
              <Link href="/candidates">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
