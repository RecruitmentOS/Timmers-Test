import { eq, and, ilike, isNull, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  vacancies,
  vacancyAssignments,
  vacancyNotes,
  activityLog,
} from "../db/schema/index.js";
import type {
  CreateVacancyInput,
  UpdateVacancyInput,
} from "@recruitment-os/types";

export const vacancyService = {
  async list(
    orgId: string,
    filters?: {
      status?: string;
      ownerId?: string;
      clientId?: string;
      location?: string;
      search?: string;
    }
  ) {
    return withTenantContext(orgId, async (tx) => {
      const conditions = [isNull(vacancies.deletedAt)];

      if (filters?.status) {
        conditions.push(eq(vacancies.status, filters.status as any));
      }
      if (filters?.ownerId) {
        conditions.push(eq(vacancies.ownerId, filters.ownerId));
      }
      if (filters?.clientId) {
        conditions.push(eq(vacancies.clientId, filters.clientId));
      }
      if (filters?.location) {
        conditions.push(ilike(vacancies.location, `%${filters.location}%`));
      }
      if (filters?.search) {
        conditions.push(ilike(vacancies.title, `%${filters.search}%`));
      }

      return tx
        .select()
        .from(vacancies)
        .where(and(...conditions))
        .orderBy(sql`${vacancies.createdAt} DESC`);
    });
  },

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(vacancies)
        .where(and(eq(vacancies.id, id), isNull(vacancies.deletedAt)));
      return rows[0] ?? null;
    });
  },

  async create(orgId: string, userId: string, data: CreateVacancyInput) {
    return withTenantContext(orgId, async (tx) => {
      const [vacancy] = await tx
        .insert(vacancies)
        .values({
          organizationId: orgId,
          ownerId: userId,
          title: data.title,
          description: data.description ?? null,
          location: data.location ?? null,
          employmentType: data.employmentType ?? null,
          clientId: data.clientId ?? null,
          qualificationCriteria: data.qualificationCriteria ?? null,
        })
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "vacancy",
        entityId: vacancy.id,
        action: "created",
        actorId: userId,
        metadata: { title: vacancy.title },
      });

      return vacancy;
    });
  },

  async update(orgId: string, id: string, data: UpdateVacancyInput) {
    return withTenantContext(orgId, async (tx) => {
      const [vacancy] = await tx
        .update(vacancies)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(vacancies.id, id))
        .returning();

      if (vacancy) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "vacancy",
          entityId: id,
          action: "updated",
          actorId: vacancy.ownerId,
          metadata: { fields: Object.keys(data) },
        });
      }

      return vacancy ?? null;
    });
  },

  async delete(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .update(vacancies)
        .set({ deletedAt: new Date() })
        .where(eq(vacancies.id, id));
    });
  },

  async addAssignment(
    orgId: string,
    vacancyId: string,
    userId: string,
    role: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      await tx.insert(vacancyAssignments).values({
        organizationId: orgId,
        vacancyId,
        userId,
        role,
      });
    });
  },

  async removeAssignment(orgId: string, vacancyId: string, userId: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .delete(vacancyAssignments)
        .where(
          and(
            eq(vacancyAssignments.vacancyId, vacancyId),
            eq(vacancyAssignments.userId, userId)
          )
        );
    });
  },

  async getAssignments(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(vacancyAssignments)
        .where(eq(vacancyAssignments.vacancyId, vacancyId));
    });
  },

  async addNote(
    orgId: string,
    vacancyId: string,
    authorId: string,
    content: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [note] = await tx
        .insert(vacancyNotes)
        .values({
          organizationId: orgId,
          vacancyId,
          authorId,
          content,
        })
        .returning();
      return note;
    });
  },

  async getNotes(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(vacancyNotes)
        .where(eq(vacancyNotes.vacancyId, vacancyId))
        .orderBy(sql`${vacancyNotes.createdAt} DESC`);
    });
  },
};
