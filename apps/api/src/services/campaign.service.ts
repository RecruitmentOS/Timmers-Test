import { eq, and, sql, count } from "drizzle-orm";
import { z } from "zod";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  campaigns,
  candidateApplications,
  candidates,
  pipelineStages,
  vacancies,
} from "../db/schema/index.js";
import type {
  CampaignDashboardMetrics,
} from "@recruitment-os/types";

// ============================================================
// Zod validation schemas
// ============================================================

export const createCampaignSchema = z.object({
  vacancyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  channel: z.enum(["meta", "indeed", "google", "linkedin", "manual"]),
  budgetCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  spendCents: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  impressions: z.number().int().nonnegative().optional(),
});

// ============================================================
// Campaign service
// ============================================================

export const campaignService = {
  /**
   * Create a new campaign linked to a vacancy.
   */
  async createCampaign(
    orgId: string,
    userId: string,
    input: z.infer<typeof createCampaignSchema>
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          organizationId: orgId,
          vacancyId: input.vacancyId,
          name: input.name,
          channel: input.channel,
          budgetCents: input.budgetCents ?? null,
          currency: input.currency ?? "EUR",
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
        })
        .returning();

      return campaign;
    });
  },

  /**
   * List campaigns with optional filters, ordered by createdAt desc.
   */
  async getCampaigns(
    orgId: string,
    filters?: { vacancyId?: string; status?: string; channel?: string }
  ) {
    return withTenantContext(orgId, async (tx) => {
      const conditions: ReturnType<typeof eq>[] = [];

      if (filters?.vacancyId) {
        conditions.push(eq(campaigns.vacancyId, filters.vacancyId));
      }
      if (filters?.status) {
        conditions.push(eq(campaigns.status, filters.status));
      }
      if (filters?.channel) {
        conditions.push(eq(campaigns.channel, filters.channel));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      return tx
        .select()
        .from(campaigns)
        .where(whereClause)
        .orderBy(sql`${campaigns.createdAt} DESC`);
    });
  },

  /**
   * Get a single campaign with vacancy name joined.
   */
  async getCampaignById(orgId: string, campaignId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          campaign: campaigns,
          vacancyTitle: vacancies.title,
        })
        .from(campaigns)
        .innerJoin(vacancies, eq(campaigns.vacancyId, vacancies.id))
        .where(eq(campaigns.id, campaignId));

      if (!rows[0]) return null;

      return {
        ...rows[0].campaign,
        vacancyTitle: rows[0].vacancyTitle,
      };
    });
  },

  /**
   * Partial update of a campaign. Handles CAMP-02 manual spend entry
   * (spendCents, clicks, impressions fields).
   */
  async updateCampaign(
    orgId: string,
    campaignId: string,
    input: z.infer<typeof updateCampaignSchema>
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [updated] = await tx
        .update(campaigns)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId))
        .returning();

      return updated ?? null;
    });
  },

  /**
   * Delete a campaign. Follows project pattern of soft delete via status.
   */
  async deleteCampaign(orgId: string, campaignId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Unlink applications from this campaign before deleting
      await tx
        .update(candidateApplications)
        .set({ campaignId: null })
        .where(eq(candidateApplications.campaignId, campaignId));

      await tx.delete(campaigns).where(eq(campaigns.id, campaignId));
    });
  },

  /**
   * Get attribution dashboard metrics for a campaign (CAMP-04, CAMP-09).
   * Returns spend, clicks, impressions, applications, qualified, hired,
   * and cost-per-* ratios.
   */
  async getCampaignMetrics(
    orgId: string,
    campaignId: string
  ): Promise<CampaignDashboardMetrics | null> {
    return withTenantContext(orgId, async (tx) => {
      // Get the campaign itself for spend/clicks/impressions
      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));

      if (!campaign) return null;

      // Count total applications linked to this campaign
      const [appCount] = await tx
        .select({ count: count() })
        .from(candidateApplications)
        .where(eq(candidateApplications.campaignId, campaignId));

      // Count qualified applications (yes or maybe)
      const [qualifiedCount] = await tx
        .select({ count: count() })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.campaignId, campaignId),
            sql`${candidateApplications.qualificationStatus} IN ('yes', 'maybe')`
          )
        );

      // Count hired applications (stage name = 'Hired')
      const [hiredCount] = await tx
        .select({ count: count() })
        .from(candidateApplications)
        .innerJoin(
          pipelineStages,
          eq(candidateApplications.currentStageId, pipelineStages.id)
        )
        .where(
          and(
            eq(candidateApplications.campaignId, campaignId),
            eq(pipelineStages.name, "Hired")
          )
        );

      const spend = campaign.spendCents;
      const applications = appCount.count;
      const qualified = qualifiedCount.count;
      const hired = hiredCount.count;

      return {
        spend,
        clicks: campaign.clicks,
        impressions: campaign.impressions,
        applications,
        qualified,
        hired,
        costPerApplication: applications > 0 ? spend / applications : null,
        costPerQualified: qualified > 0 ? spend / qualified : null,
        costPerHire: hired > 0 ? spend / hired : null,
      };
    });
  },

  /**
   * Get paginated list of applications linked to a campaign (CAMP-09 drill-down).
   */
  async getCampaignApplications(
    orgId: string,
    campaignId: string,
    pagination: { page?: number; limit?: number } = {}
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const offset = (page - 1) * limit;

    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: candidateApplications.id,
          candidateId: candidateApplications.candidateId,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          stageName: pipelineStages.name,
          qualificationStatus: candidateApplications.qualificationStatus,
          sourceDetail: candidateApplications.sourceDetail,
          createdAt: candidateApplications.createdAt,
        })
        .from(candidateApplications)
        .innerJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .leftJoin(
          pipelineStages,
          eq(candidateApplications.currentStageId, pipelineStages.id)
        )
        .where(eq(candidateApplications.campaignId, campaignId))
        .orderBy(sql`${candidateApplications.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const [total] = await tx
        .select({ count: count() })
        .from(candidateApplications)
        .where(eq(candidateApplications.campaignId, campaignId));

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: total.count,
          totalPages: Math.ceil(total.count / limit),
        },
      };
    });
  },

  /**
   * List all campaigns with inline application count and spend
   * for the campaign list view.
   */
  async getCampaignsWithMetrics(orgId: string, vacancyId?: string) {
    return withTenantContext(orgId, async (tx) => {
      const conditions: ReturnType<typeof eq>[] = [];

      if (vacancyId) {
        conditions.push(eq(campaigns.vacancyId, vacancyId));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await tx
        .select({
          campaign: campaigns,
          applicationCount: sql<number>`COALESCE(COUNT(${candidateApplications.id}), 0)::int`,
        })
        .from(campaigns)
        .leftJoin(
          candidateApplications,
          eq(candidateApplications.campaignId, campaigns.id)
        )
        .where(whereClause)
        .groupBy(campaigns.id)
        .orderBy(sql`${campaigns.createdAt} DESC`);

      return rows.map((r) => ({
        ...r.campaign,
        applicationCount: r.applicationCount,
      }));
    });
  },
};
