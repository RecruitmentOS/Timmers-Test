import { eq, and, or } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidates,
  candidateApplications,
  campaigns,
  pipelineStages,
  fileMetadata,
  activityLog,
} from "../db/schema/index.js";
import type { PublicApplyInput } from "@recruitment-os/types";

export const applyService = {
  /**
   * Submit an application from the public apply page.
   *
   * In a single withTenantContext transaction:
   * 1. Create candidate (person-level data)
   * 2. Find the default "New" pipeline stage
   * 3. Create candidateApplication linked to candidate + vacancy
   * 4. If cvFileId is set, link the file to the candidate
   * 5. Log activity
   */
  async submitApplication(
    orgId: string,
    vacancyId: string,
    input: PublicApplyInput,
    ownerId: string
  ): Promise<{ candidateId: string; applicationId: string }> {
    return withTenantContext(orgId, async (tx) => {
      // 1. Create candidate
      const [candidate] = await tx
        .insert(candidates)
        .values({
          organizationId: orgId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          email: input.email,
          city: input.city ?? null,
          source: input.utmSource || "direct",
        })
        .returning();

      // 2. Find the default "New" pipeline stage for this org
      const defaultStageRows = await tx
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .where(
          and(
            eq(pipelineStages.organizationId, orgId),
            eq(pipelineStages.isDefault, true)
          )
        );

      // Fallback: look for stage named "New" if no default is set
      let defaultStageId = defaultStageRows[0]?.id ?? null;
      if (!defaultStageId) {
        const newStageRows = await tx
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.organizationId, orgId),
              eq(pipelineStages.name, "New")
            )
          );
        defaultStageId = newStageRows[0]?.id ?? null;
      }

      // 3. Create candidate application
      const [application] = await tx
        .insert(candidateApplications)
        .values({
          organizationId: orgId,
          candidateId: candidate.id,
          vacancyId,
          ownerId,
          currentStageId: defaultStageId,
          qualificationStatus: "pending",
          sentToClient: false,
          sourceDetail: "apply-page",
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
        })
        .returning();

      // 4. Record and link CV file to candidate if S3 key provided
      if (input.cvFileId) {
        // cvFileId is actually the S3 key from the public upload-url endpoint
        await tx.insert(fileMetadata).values({
          organizationId: orgId,
          entityType: "candidate",
          entityId: candidate.id,
          filename: input.cvFileId.split("/").pop() || "cv",
          contentType: "application/pdf",
          sizeBytes: 0,
          s3Key: input.cvFileId,
          uploadedBy: ownerId, // vacancy owner as proxy
        });
      }

      // 5. Log activity
      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: application.id,
        action: "created",
        actorId: ownerId,
        metadata: {
          source: "apply-page",
          candidateName: `${input.firstName} ${input.lastName}`,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
        },
      });

      // 6. UTM auto-linking (CAMP-03): link application to campaign if utmCampaign matches
      if (input.utmCampaign) {
        try {
          const matchedCampaign = await tx
            .select({ id: campaigns.id })
            .from(campaigns)
            .where(
              and(
                eq(campaigns.organizationId, orgId),
                or(
                  eq(campaigns.id, input.utmCampaign),
                  eq(campaigns.name, input.utmCampaign)
                )
              )
            );

          if (matchedCampaign[0]) {
            await tx
              .update(candidateApplications)
              .set({ campaignId: matchedCampaign[0].id })
              .where(eq(candidateApplications.id, application.id));
          }
        } catch {
          // Non-blocking enrichment: never fail the apply submission (research pitfall #4)
          console.log("[apply] UTM campaign linking failed, continuing");
        }
      }

      return {
        candidateId: candidate.id,
        applicationId: application.id,
      };
    });
  },
};
