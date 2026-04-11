import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  personaTemplates,
  targetingTemplates,
} from "../db/schema/index.js";

/**
 * Zod schema for persona template input.
 * candidateCriteria is a non-empty object describing the ideal candidate.
 */
export const createPersonaTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  vacancyId: z.string().uuid().optional(),
  candidateCriteria: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "candidateCriteria must be a non-empty object",
    }),
  targetingTemplateId: z.string().uuid().optional(),
});

export type CreatePersonaTemplateInput = z.infer<
  typeof createPersonaTemplateSchema
>;

export async function createPersonaTemplate(
  orgId: string,
  userId: string,
  input: CreatePersonaTemplateInput
) {
  return withTenantContext(orgId, async (tx) => {
    const [template] = await tx
      .insert(personaTemplates)
      .values({
        organizationId: orgId,
        name: input.name,
        vacancyId: input.vacancyId ?? null,
        candidateCriteria: input.candidateCriteria,
        targetingTemplateId: input.targetingTemplateId ?? null,
        createdBy: userId,
      })
      .returning();
    return template;
  });
}

export async function getPersonaTemplates(
  orgId: string,
  filters?: { vacancyId?: string }
) {
  return withTenantContext(orgId, async (tx) => {
    const conditions = [];
    if (filters?.vacancyId) {
      conditions.push(eq(personaTemplates.vacancyId, filters.vacancyId));
    }

    const query = tx
      .select()
      .from(personaTemplates)
      .orderBy(sql`${personaTemplates.name} ASC`);

    if (conditions.length > 0) {
      return query.where(conditions[0]);
    }
    return query;
  });
}

export async function getPersonaTemplateById(orgId: string, id: string) {
  return withTenantContext(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: personaTemplates.id,
        organizationId: personaTemplates.organizationId,
        vacancyId: personaTemplates.vacancyId,
        name: personaTemplates.name,
        candidateCriteria: personaTemplates.candidateCriteria,
        targetingTemplateId: personaTemplates.targetingTemplateId,
        createdBy: personaTemplates.createdBy,
        createdAt: personaTemplates.createdAt,
        updatedAt: personaTemplates.updatedAt,
        targetingTemplateName: targetingTemplates.name,
      })
      .from(personaTemplates)
      .leftJoin(
        targetingTemplates,
        eq(personaTemplates.targetingTemplateId, targetingTemplates.id)
      )
      .where(eq(personaTemplates.id, id));
    return rows[0] ?? null;
  });
}

export async function updatePersonaTemplate(
  orgId: string,
  id: string,
  input: Partial<CreatePersonaTemplateInput>
) {
  return withTenantContext(orgId, async (tx) => {
    const [template] = await tx
      .update(personaTemplates)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.vacancyId !== undefined && { vacancyId: input.vacancyId }),
        ...(input.candidateCriteria !== undefined && {
          candidateCriteria: input.candidateCriteria,
        }),
        ...(input.targetingTemplateId !== undefined && {
          targetingTemplateId: input.targetingTemplateId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(personaTemplates.id, id))
      .returning();
    return template ?? null;
  });
}

export async function deletePersonaTemplate(orgId: string, id: string) {
  return withTenantContext(orgId, async (tx) => {
    await tx
      .delete(personaTemplates)
      .where(eq(personaTemplates.id, id));
  });
}
