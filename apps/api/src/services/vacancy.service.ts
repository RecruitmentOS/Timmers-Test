import { eq, ne, and, ilike, isNull, sql } from "drizzle-orm";
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
import { getJobQueue } from "../lib/job-queue.js";

/**
 * Generate a URL-safe slug from a vacancy title.
 * Lowercase, replace spaces with hyphens, remove special chars, max 100 chars.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

/**
 * Ensure slug uniqueness within an org by appending a counter suffix.
 */
async function ensureUniqueSlug(
  orgId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const existing = await withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({ id: vacancies.id })
        .from(vacancies)
        .where(eq(vacancies.slug, slug));
      return rows.length > 0;
    });

    if (!existing) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

export const vacancyService = {
  async list(
    orgId: string,
    filters?: {
      status?: string;
      ownerId?: string;
      clientId?: string;
      location?: string;
      search?: string;
      includeArchived?: boolean;
    }
  ) {
    return withTenantContext(orgId, async (tx) => {
      const conditions = [isNull(vacancies.deletedAt)];

      // Exclude archived vacancies by default unless explicitly requested
      if (!filters?.includeArchived) {
        conditions.push(ne(vacancies.status, "archived" as any));
      }

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
    // Auto-generate slug from title
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(orgId, baseSlug);

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
          slug,
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

      // Queue async geocoding if location is provided
      if (data.location) {
        try {
          const boss = getJobQueue();
          await boss.send("geo.geocode_vacancy", {
            orgId,
            vacancyId: vacancy.id,
            location: data.location,
          }, { retryLimit: 2, retryDelay: 5 });
        } catch {
          console.log("[vacancy] geocoding job queue unavailable, skipping");
        }
      }

      return vacancy;
    });
  },

  async update(orgId: string, id: string, data: UpdateVacancyInput) {
    return withTenantContext(orgId, async (tx) => {
      // Check if location changed (for geocoding decision)
      let locationChanged = false;
      if (data.location !== undefined) {
        const [existing] = await tx
          .select({ location: vacancies.location })
          .from(vacancies)
          .where(eq(vacancies.id, id));
        locationChanged = existing?.location !== data.location;
      }

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

        // Queue geocoding if location changed
        if (locationChanged && data.location) {
          try {
            const boss = getJobQueue();
            await boss.send("geo.geocode_vacancy", {
              orgId,
              vacancyId: id,
              location: data.location,
            }, { retryLimit: 2, retryDelay: 5 });
          } catch {
            console.log("[vacancy] geocoding job queue unavailable, skipping");
          }
        }
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

  async archive(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [vacancy] = await tx
        .update(vacancies)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(vacancies.id, vacancyId))
        .returning();

      if (vacancy) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "vacancy",
          entityId: vacancyId,
          action: "archived",
          actorId: vacancy.ownerId,
          metadata: { title: vacancy.title },
        });
      }

      return vacancy ?? null;
    });
  },

  async unarchive(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [vacancy] = await tx
        .update(vacancies)
        .set({
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(vacancies.id, vacancyId))
        .returning();

      if (vacancy) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "vacancy",
          entityId: vacancyId,
          action: "unarchived",
          actorId: vacancy.ownerId,
          metadata: { title: vacancy.title },
        });
      }

      return vacancy ?? null;
    });
  },
};
