import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  organization,
  member,
  session,
} from "../db/schema/auth.js";
import { pipelineStages } from "../db/schema/pipeline-stages.js";
import { qualificationPresets } from "../db/schema/qualification-presets.js";
import { tenantBilling } from "../db/schema/billing.js";
import type { OnboardingInput, OnboardingResult } from "@recruitment-os/types";

/**
 * Default pipeline stages shared between both modes.
 * Agency mode adds "Sent to client" after "Qualified".
 */
const BASE_STAGES = [
  { name: "Nieuw", slug: "new", sortOrder: 0, isDefault: true },
  { name: "Te screenen", slug: "to-screen", sortOrder: 1 },
  { name: "Contactpoging", slug: "contact-attempted", sortOrder: 2 },
  { name: "Gecontacteerd", slug: "contacted", sortOrder: 3 },
  { name: "Gekwalificeerd", slug: "qualified", sortOrder: 4 },
  // "Sent to client" inserted here for agency mode (sortOrder 5)
  { name: "Interview", slug: "interview", sortOrder: 5 },
  { name: "Aangenomen", slug: "hired", sortOrder: 6 },
  { name: "Gestart", slug: "started", sortOrder: 7 },
  { name: "Afgewezen / On hold", slug: "rejected-on-hold", sortOrder: 8 },
];

const AGENCY_EXTRA_STAGE = {
  name: "Sent to client",
  slug: "sent-to-client",
  sortOrder: 5,
};

/**
 * Default transport/chauffeur qualification presets.
 */
const TRANSPORT_PRESETS = [
  {
    name: "Chauffeur CE",
    criteria: JSON.stringify([
      { type: "license", value: "CE", required: true },
      { type: "license", value: "code_95", required: true },
      { type: "experience", minYears: 2, description: "Minimaal 2 jaar ervaring CE" },
      { type: "document", value: "digitachograaf", required: true },
    ]),
    isDefault: true,
  },
  {
    name: "Chauffeur C",
    criteria: JSON.stringify([
      { type: "license", value: "C", required: true },
      { type: "license", value: "code_95", required: true },
      { type: "experience", minYears: 1, description: "Minimaal 1 jaar ervaring C" },
    ]),
    isDefault: true,
  },
];

/**
 * Onboarding service — organization creation + data seeding for self-service signup.
 */
export const onboardingService = {
  /**
   * Generate a URL-safe slug from org name, ensuring uniqueness.
   */
  async generateSubdomainSlug(orgName: string): Promise<string> {
    // Slugify: lowercase, replace non-alphanumeric with hyphens, collapse, trim
    let base = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);

    if (!base) base = "org";

    // Check uniqueness
    let slug = base;
    let counter = 1;
    while (true) {
      const existing = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
        .limit(1);

      if (existing.length === 0) break;

      counter++;
      slug = `${base}-${counter}`.slice(0, 50);
    }

    return slug;
  },

  /**
   * Full onboarding flow: create org, link user, seed data, set up billing.
   */
  async createOrganization(
    userId: string,
    userEmail: string,
    sessionId: string,
    input: OnboardingInput
  ): Promise<OnboardingResult> {
    const slug = await this.generateSubdomainSlug(input.orgName);
    const orgId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial

    // 1. Create organization
    await db.insert(organization).values({
      id: orgId,
      name: input.orgName,
      slug,
      metadata: JSON.stringify({
        mode: input.mode,
        primaryLocation: input.primaryLocation,
        expectedUserCount: input.expectedUserCount,
      }),
    });

    // 2. Create member linking user as owner
    await db.insert(member).values({
      id: memberId,
      userId,
      organizationId: orgId,
      role: "owner",
    });

    // 3. Update session to set activeOrganizationId (avoid race condition per research pitfall #5)
    await db
      .update(session)
      .set({ activeOrganizationId: orgId })
      .where(eq(session.id, sessionId));

    // 4. Seed default data
    await this.seedNewTenant(orgId, input.mode);

    // 5. Create billing record with trial
    try {
      await db.insert(tenantBilling).values({
        organizationId: orgId,
        planTier: "starter",
        trialEndsAt,
        status: "trialing",
      });

      // Optionally call billing service for Stripe integration
      try {
        const { billingService } = await import("./billing.service.js");
        if (billingService?.createCustomerAndSubscription) {
          await billingService.createCustomerAndSubscription(
            orgId,
            input.orgName,
            userEmail,
            "starter"
          );
        }
      } catch {
        // billingService may not exist yet (05-02) — billing record already created above
      }
    } catch {
      // Billing setup is non-blocking for onboarding
      console.warn(`[onboarding] Billing setup failed for org ${orgId}, continuing`);
    }

    return {
      organizationId: orgId,
      subdomain: slug,
      mode: input.mode,
      trialEndsAt: trialEndsAt.toISOString(),
    };
  },

  /**
   * Seed pipeline stages and qualification presets for a new tenant.
   */
  async seedNewTenant(orgId: string, mode: "agency" | "employer"): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      // Build stage list: agency gets "Sent to client" between Qualified and Interview
      let stages = [...BASE_STAGES];
      if (mode === "agency") {
        // Insert agency-specific stage; bump sortOrder for subsequent stages
        stages = [
          ...stages.slice(0, 5), // New through Qualified
          AGENCY_EXTRA_STAGE,
          ...stages.slice(5).map((s) => ({ ...s, sortOrder: s.sortOrder + 1 })),
        ];
      }

      // Insert pipeline stages
      await tx.insert(pipelineStages).values(
        stages.map((s) => ({
          organizationId: orgId,
          name: s.name,
          slug: s.slug,
          sortOrder: s.sortOrder,
          isDefault: s.isDefault ?? false,
        }))
      );

      // Insert qualification presets
      await tx.insert(qualificationPresets).values(
        TRANSPORT_PRESETS.map((p) => ({
          organizationId: orgId,
          name: p.name,
          criteria: p.criteria,
          isDefault: p.isDefault,
        }))
      );
    });
  },

  /**
   * Check if a slug is available.
   */
  async checkSlugAvailability(slug: string): Promise<boolean> {
    const existing = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);

    return existing.length === 0;
  },
};
