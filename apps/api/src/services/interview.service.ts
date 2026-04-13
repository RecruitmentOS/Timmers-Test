import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { interviews } from "../db/schema/interviews.js";
import { calendarService } from "./calendar.service.js";
import { taskService } from "./task.service.js";
import { emailService } from "./email.service.js";
import type { CreateInterviewInput } from "@recruitment-os/types";

// ============================================================
// Interview service — scheduling with calendar event + task creation
// ============================================================

export const interviewService = {
  /**
   * Schedule an interview:
   * 1. Insert interview row
   * 2. Create calendar event if connection provided
   * 3. Create task for the interviewer
   * 4. Send invite email to candidate
   */
  async schedule(
    orgId: string,
    input: CreateInterviewInput & {
      candidateName: string;
      candidateEmail?: string;
      vacancyTitle: string;
    },
    userId: string
  ) {
    const scheduledAt = new Date(input.scheduledAt);
    const durationMinutes = input.durationMinutes ?? 30;
    const endTime = new Date(
      scheduledAt.getTime() + durationMinutes * 60 * 1000
    );

    // 1. Insert interview row
    const interview = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .insert(interviews)
        .values({
          organizationId: orgId,
          applicationId: input.applicationId,
          vacancyId: input.vacancyId,
          candidateId: input.candidateId,
          scheduledBy: userId,
          calendarConnectionId: input.calendarConnectionId ?? null,
          scheduledAt,
          durationMinutes,
          location: input.location ?? null,
          notes: input.notes ?? null,
          status: "scheduled",
        })
        .returning();
      return row;
    });

    // 2. Create calendar event if connection provided
    let calendarEventId: string | null = null;
    if (input.calendarConnectionId) {
      try {
        calendarEventId = await calendarService.createEvent(
          input.calendarConnectionId,
          {
            summary: `Interview: ${input.candidateName} - ${input.vacancyTitle}`,
            description: input.notes ?? undefined,
            startTime: scheduledAt,
            endTime,
            location: input.location ?? undefined,
            attendees: input.candidateEmail
              ? [input.candidateEmail]
              : undefined,
          }
        );

        // Store calendar event ID on interview
        if (calendarEventId) {
          await withTenantContext(orgId, async (tx) => {
            await tx
              .update(interviews)
              .set({ calendarEventId, updatedAt: new Date() })
              .where(eq(interviews.id, interview.id));
          });
        }
      } catch (err) {
        console.error("[interview] Calendar event creation failed:", err);
        // Non-fatal — interview still created, just without calendar event
      }
    }

    // 3. Create task for the interviewer
    try {
      await taskService.create(orgId, userId, {
        title: `Interview: ${input.candidateName} - ${input.vacancyTitle}`,
        description: `Interview gepland op ${scheduledAt.toLocaleString("nl-NL")}${input.location ? ` - Locatie: ${input.location}` : ""}`,
        vacancyId: input.vacancyId,
        assignedToUserId: userId,
        dueDate: input.scheduledAt,
        priority: "high",
      });
    } catch (err) {
      console.error("[interview] Task creation failed:", err);
      // Non-fatal — interview still valid
    }

    // 4. Send invite email to candidate
    if (input.candidateEmail) {
      try {
        await emailService.sendApplicationConfirmation(
          input.candidateEmail,
          {
            candidateName: input.candidateName,
            vacancyTitle: `Interview: ${input.vacancyTitle} - ${scheduledAt.toLocaleDateString("nl-NL")} ${scheduledAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`,
            orgName: "Recruitment OS",
            language: "nl",
          }
        );
      } catch (err) {
        console.error("[interview] Email send failed:", err);
      }
    }

    return { ...interview, calendarEventId };
  },

  /**
   * List interviews with optional filters.
   */
  async list(
    orgId: string,
    filters: {
      vacancyId?: string;
      candidateId?: string;
      applicationId?: string;
    } = {}
  ) {
    return withTenantContext(orgId, async (tx) => {
      const wheres = [];
      if (filters.vacancyId)
        wheres.push(eq(interviews.vacancyId, filters.vacancyId));
      if (filters.candidateId)
        wheres.push(eq(interviews.candidateId, filters.candidateId));
      if (filters.applicationId)
        wheres.push(eq(interviews.applicationId, filters.applicationId));

      return tx
        .select()
        .from(interviews)
        .where(wheres.length ? and(...wheres) : undefined)
        .orderBy(interviews.scheduledAt);
    });
  },

  /**
   * Update interview status, notes, or reschedule.
   */
  async update(
    orgId: string,
    interviewId: string,
    data: Partial<{
      status: string;
      notes: string;
      scheduledAt: string;
      durationMinutes: number;
      location: string;
    }>
  ) {
    return withTenantContext(orgId, async (tx) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.status) updateData.status = data.status;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
      if (data.durationMinutes) updateData.durationMinutes = data.durationMinutes;
      if (data.location !== undefined) updateData.location = data.location;

      const [row] = await tx
        .update(interviews)
        .set(updateData)
        .where(eq(interviews.id, interviewId))
        .returning();
      return row ?? null;
    });
  },

  /**
   * Cancel an interview. Sets status to "cancelled".
   */
  async cancel(orgId: string, interviewId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .update(interviews)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(interviews.id, interviewId))
        .returning();
      return row ?? null;
    });
  },
};
