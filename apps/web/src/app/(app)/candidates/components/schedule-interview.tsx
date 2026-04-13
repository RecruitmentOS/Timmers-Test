"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useCalendarConnections } from "@/hooks/use-calendar";
import { useScheduleInterview } from "@/hooks/use-interviews";
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
import { Calendar } from "lucide-react";

interface ScheduleInterviewProps {
  applicationId: string;
  vacancyId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  vacancyTitle: string;
}

interface InterviewForm {
  date: string;
  time: string;
  duration: string;
  location: string;
  notes: string;
  calendarConnectionId: string;
}

export function ScheduleInterview({
  applicationId,
  vacancyId,
  candidateId,
  candidateName,
  candidateEmail,
  vacancyTitle,
}: ScheduleInterviewProps) {
  const [open, setOpen] = useState(false);
  const { data: connections } = useCalendarConnections();
  const scheduleMutation = useScheduleInterview();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<InterviewForm>({
    defaultValues: {
      duration: "30",
      location: "",
      notes: "",
      calendarConnectionId: "",
    },
  });

  const selectedConnectionId = watch("calendarConnectionId");

  const onSubmit = async (data: InterviewForm) => {
    const scheduledAt = new Date(
      `${data.date}T${data.time}:00`
    ).toISOString();

    await scheduleMutation.mutateAsync({
      applicationId,
      vacancyId,
      candidateId,
      scheduledAt,
      durationMinutes: parseInt(data.duration, 10),
      location: data.location || undefined,
      notes: data.notes || undefined,
      calendarConnectionId: data.calendarConnectionId || undefined,
      candidateName,
      candidateEmail,
      vacancyTitle,
    });

    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Interview plannen
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Interview plannen</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Plan een interview met {candidateName} voor {vacancyTitle}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                {...register("date", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Tijd</Label>
              <Input
                id="time"
                type="time"
                {...register("time", { required: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duur</Label>
            <Select
              value={watch("duration")}
              onValueChange={(v) => setValue("duration", v as string)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer duur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minuten</SelectItem>
                <SelectItem value="30">30 minuten</SelectItem>
                <SelectItem value="45">45 minuten</SelectItem>
                <SelectItem value="60">60 minuten</SelectItem>
                <SelectItem value="90">90 minuten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Locatie</Label>
            <Input
              id="location"
              placeholder="Kantoor, videocall, etc."
              {...register("location")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Eventuele notities voor het interview..."
              {...register("notes")}
            />
          </div>

          {/* Calendar connection selector */}
          {connections && connections.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="calendarConnection">Agenda-koppeling</Label>
              <Select
                value={selectedConnectionId}
                onValueChange={(v) =>
                  setValue("calendarConnectionId", v as string)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer agenda (optioneel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Geen agenda</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.provider === "google"
                        ? "Google Calendar"
                        : "Outlook Calendar"}
                      {conn.calendarEmail ? ` (${conn.calendarEmail})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Een agenda-event wordt automatisch aangemaakt als je een
                koppeling selecteert.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Geen agenda gekoppeld. Het interview wordt als taak aangemaakt
              zonder agenda-event.{" "}
              <a
                href="/settings/calendar"
                className="text-primary hover:underline"
              >
                Agenda koppelen
              </a>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending
                ? "Plannen..."
                : "Interview plannen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
