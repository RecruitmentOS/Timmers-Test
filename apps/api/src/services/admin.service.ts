import { eq, and, sql, ne } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  organization,
  member,
  user,
  invitation,
  pipelineStages,
  qualificationPresets,
  candidateApplications,
} from "../db/schema/index.js";
import { db } from "../db/index.js";
import { auth } from "../auth.js";
import { AppError } from "../lib/errors.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const adminService = {
  // ==========================================
  // Organization settings
  // ==========================================

  async getOrgSettings(orgId: string) {
    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        metadata: organization.metadata,
      })
      .from(organization)
      .where(eq(organization.id, orgId));
    return rows[0] ?? null;
  },

  async updateOrgSettings(
    orgId: string,
    data: { name?: string; logo?: string | null; metadata?: string | null }
  ) {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) {
      updates.name = data.name;
      const newSlug = slugify(data.name);
      // Check slug uniqueness
      const existing = await db
        .select({ id: organization.id })
        .from(organization)
        .where(and(eq(organization.slug, newSlug), ne(organization.id, orgId)));
      if (existing.length > 0) {
        throw new AppError(409, "Slug already in use");
      }
      updates.slug = newSlug;
    }
    if (data.logo !== undefined) updates.logo = data.logo;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    if (Object.keys(updates).length === 0) return null;

    const rows = await db
      .update(organization)
      .set(updates)
      .where(eq(organization.id, orgId))
      .returning();
    return rows[0] ?? null;
  },

  // ==========================================
  // Team members
  // ==========================================

  async getTeamMembers(orgId: string) {
    const rows = await db
      .select({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(sql`${member.createdAt} ASC`);
    return rows;
  },

  async inviteMember(orgId: string, email: string, role: string, inviterId: string) {
    // Use Better Auth's invitation API
    const result = await auth.api.createInvitation({
      body: {
        organizationId: orgId,
        email,
        role: role as "super_admin" | "agency_admin" | "recruiter" | "agent" | "hiring_manager" | "client_viewer" | "marketing_op",
      },
      headers: new Headers(),
    });
    return result;
  },

  async updateMemberRole(orgId: string, memberId: string, newRole: string) {
    const rows = await db
      .update(member)
      .set({ role: newRole })
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)))
      .returning();
    return rows[0] ?? null;
  },

  async removeMember(orgId: string, memberId: string) {
    await db
      .delete(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));
  },

  // ==========================================
  // Pipeline stages
  // ==========================================

  async getPipelineStages(orgId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(pipelineStages)
        .orderBy(sql`${pipelineStages.sortOrder} ASC`);
    });
  },

  async createPipelineStage(orgId: string, name: string) {
    return withTenantContext(orgId, async (tx) => {
      // Get max sort order
      const maxResult = await tx
        .select({ maxOrder: sql<number>`COALESCE(MAX(${pipelineStages.sortOrder}), -1)` })
        .from(pipelineStages);
      const nextOrder = (maxResult[0]?.maxOrder ?? -1) + 1;

      const [stage] = await tx
        .insert(pipelineStages)
        .values({
          organizationId: orgId,
          name,
          slug: slugify(name),
          sortOrder: nextOrder,
          isDefault: false,
        })
        .returning();
      return stage;
    });
  },

  async updatePipelineStage(
    orgId: string,
    stageId: string,
    data: { name?: string }
  ) {
    return withTenantContext(orgId, async (tx) => {
      const updates: Record<string, unknown> = {};
      if (data.name) {
        updates.name = data.name;
        updates.slug = slugify(data.name);
      }
      if (Object.keys(updates).length === 0) return null;

      const [stage] = await tx
        .update(pipelineStages)
        .set(updates)
        .where(eq(pipelineStages.id, stageId))
        .returning();
      return stage ?? null;
    });
  },

  async reorderPipelineStages(orgId: string, stageIds: string[]) {
    return withTenantContext(orgId, async (tx) => {
      for (let i = 0; i < stageIds.length; i++) {
        await tx
          .update(pipelineStages)
          .set({ sortOrder: i })
          .where(eq(pipelineStages.id, stageIds[i]));
      }
    });
  },

  async deletePipelineStage(orgId: string, stageId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Guard: cannot delete if applications exist in this stage
      const apps = await tx
        .select({ id: candidateApplications.id })
        .from(candidateApplications)
        .where(eq(candidateApplications.currentStageId, stageId))
        .limit(1);

      if (apps.length > 0) {
        throw new AppError(
          409,
          "Kan fase niet verwijderen: er zijn nog sollicitaties in deze fase"
        );
      }

      await tx
        .delete(pipelineStages)
        .where(eq(pipelineStages.id, stageId));
    });
  },

  // ==========================================
  // Qualification presets
  // ==========================================

  async getQualificationPresets(orgId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(qualificationPresets)
        .orderBy(sql`${qualificationPresets.createdAt} DESC`);
    });
  },

  async createQualificationPreset(
    orgId: string,
    name: string,
    criteria: string,
    isDefault: boolean
  ) {
    return withTenantContext(orgId, async (tx) => {
      // If isDefault=true, unset other defaults first
      if (isDefault) {
        await tx
          .update(qualificationPresets)
          .set({ isDefault: false })
          .where(eq(qualificationPresets.isDefault, true));
      }

      const [preset] = await tx
        .insert(qualificationPresets)
        .values({
          organizationId: orgId,
          name,
          criteria,
          isDefault,
        })
        .returning();
      return preset;
    });
  },

  async updateQualificationPreset(
    orgId: string,
    presetId: string,
    data: { name?: string; criteria?: string; isDefault?: boolean }
  ) {
    return withTenantContext(orgId, async (tx) => {
      // If setting isDefault=true, unset other defaults first
      if (data.isDefault === true) {
        await tx
          .update(qualificationPresets)
          .set({ isDefault: false })
          .where(eq(qualificationPresets.isDefault, true));
      }

      const updates: Record<string, unknown> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.criteria !== undefined) updates.criteria = data.criteria;
      if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

      if (Object.keys(updates).length === 0) return null;

      const [preset] = await tx
        .update(qualificationPresets)
        .set(updates)
        .where(eq(qualificationPresets.id, presetId))
        .returning();
      return preset ?? null;
    });
  },

  async deleteQualificationPreset(orgId: string, presetId: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .delete(qualificationPresets)
        .where(eq(qualificationPresets.id, presetId));
    });
  },
};
