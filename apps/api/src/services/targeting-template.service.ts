import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { targetingTemplates } from "../db/schema/index.js";

/**
 * Zod schema for targeting spec validation.
 * Mirrors the TargetingSpec interface from @recruitment-os/types.
 *
 * EU employment ad compliance: age_min, age_max, and gender fields
 * are explicitly forbidden (research pitfall #5).
 */
const targetingSpecSchema = z
  .object({
    geoLocations: z
      .object({
        countries: z.array(z.string()).optional(),
        regions: z.array(z.object({ key: z.string() })).optional(),
        cities: z
          .array(
            z.object({
              key: z.string(),
              radius: z.number(),
              distanceUnit: z.string(),
            })
          )
          .optional(),
      })
      .refine(
        (geo) =>
          (geo.countries && geo.countries.length > 0) ||
          (geo.regions && geo.regions.length > 0) ||
          (geo.cities && geo.cities.length > 0),
        {
          message:
            "geoLocations must have at least one of countries, regions, or cities",
        }
      ),
    locales: z.array(z.number()).optional(),
    interests: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .optional(),
  })
  .strict();

export const createTargetingTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  targetingSpec: targetingSpecSchema,
});

export type CreateTargetingTemplateInput = z.infer<
  typeof createTargetingTemplateSchema
>;

export async function createTargetingTemplate(
  orgId: string,
  userId: string,
  input: CreateTargetingTemplateInput
) {
  return withTenantContext(orgId, async (tx) => {
    const [template] = await tx
      .insert(targetingTemplates)
      .values({
        organizationId: orgId,
        name: input.name,
        targetingSpec: input.targetingSpec,
        createdBy: userId,
      })
      .returning();
    return template;
  });
}

export async function getTargetingTemplates(orgId: string) {
  return withTenantContext(orgId, async (tx) => {
    return tx
      .select()
      .from(targetingTemplates)
      .orderBy(sql`${targetingTemplates.name} ASC`);
  });
}

export async function getTargetingTemplateById(orgId: string, id: string) {
  return withTenantContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(targetingTemplates)
      .where(eq(targetingTemplates.id, id));
    return rows[0] ?? null;
  });
}

export async function updateTargetingTemplate(
  orgId: string,
  id: string,
  input: Partial<CreateTargetingTemplateInput>
) {
  return withTenantContext(orgId, async (tx) => {
    const [template] = await tx
      .update(targetingTemplates)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.targetingSpec !== undefined && {
          targetingSpec: input.targetingSpec,
        }),
        updatedAt: new Date(),
      })
      .where(eq(targetingTemplates.id, id))
      .returning();
    return template ?? null;
  });
}

export async function deleteTargetingTemplate(orgId: string, id: string) {
  return withTenantContext(orgId, async (tx) => {
    await tx
      .delete(targetingTemplates)
      .where(eq(targetingTemplates.id, id));
  });
}
