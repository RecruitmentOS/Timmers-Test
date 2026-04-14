import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { user } from "../db/schema/auth.js";
import {
  candidates,
  candidateApplications,
  tasks,
  comments,
  notifications,
  notificationPreferences,
  activityLog,
  applicationTags,
} from "../db/schema/index.js";

type NotificationPrefs = {
  emailMentions: boolean;
  emailAssignments: boolean;
  emailTaskReminders: boolean;
  emailDocumentExpiry: boolean;
};

/**
 * GDPR service — data export, notification preferences, and data retention.
 * Covers GDPR-02 (data export), GDPR-03 (notification opt-out), GDPR-05 (retention flagging).
 */
export const gdprService = {
  /**
   * Export all personal data for a user within their organization (GDPR-02).
   * Returns a JSON object suitable for download.
   */
  async exportUserData(
    userId: string,
    orgId: string
  ): Promise<Record<string, unknown>> {
    // Fetch user profile (global table, no RLS)
    const [profile] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId));

    // Tenant-scoped data
    const tenantData = await withTenantContext(orgId, async (tx) => {
      const userCandidates = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.organizationId, orgId));

      const userApplications = await tx
        .select()
        .from(candidateApplications)
        .where(eq(candidateApplications.ownerId, userId));

      const userTasks = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.assignedToUserId, userId));

      const userComments = await tx
        .select()
        .from(comments)
        .where(eq(comments.authorId, userId));

      const userNotifications = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId));

      const userActivity = await tx
        .select()
        .from(activityLog)
        .where(eq(activityLog.actorId, userId));

      return {
        candidates: userCandidates,
        applications: userApplications,
        tasks: userTasks,
        comments: userComments,
        notifications: userNotifications,
        activity: userActivity,
      };
    });

    return {
      exportedAt: new Date().toISOString(),
      user: profile ?? null,
      ...tenantData,
    };
  },

  /**
   * Get notification preferences for a user, creating defaults if none exist (GDPR-03).
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPrefs> {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (existing) {
      return {
        emailMentions: existing.emailMentions,
        emailAssignments: existing.emailAssignments,
        emailTaskReminders: existing.emailTaskReminders,
        emailDocumentExpiry: existing.emailDocumentExpiry,
      };
    }

    // Create default row (all true)
    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning();

    return {
      emailMentions: created.emailMentions,
      emailAssignments: created.emailAssignments,
      emailTaskReminders: created.emailTaskReminders,
      emailDocumentExpiry: created.emailDocumentExpiry,
    };
  },

  /**
   * Update notification preferences (upsert) (GDPR-03).
   */
  async updateNotificationPreferences(
    userId: string,
    prefs: Partial<NotificationPrefs>
  ): Promise<NotificationPrefs> {
    const [result] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        ...(prefs.emailMentions !== undefined && {
          emailMentions: prefs.emailMentions,
        }),
        ...(prefs.emailAssignments !== undefined && {
          emailAssignments: prefs.emailAssignments,
        }),
        ...(prefs.emailTaskReminders !== undefined && {
          emailTaskReminders: prefs.emailTaskReminders,
        }),
        ...(prefs.emailDocumentExpiry !== undefined && {
          emailDocumentExpiry: prefs.emailDocumentExpiry,
        }),
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...(prefs.emailMentions !== undefined && {
            emailMentions: prefs.emailMentions,
          }),
          ...(prefs.emailAssignments !== undefined && {
            emailAssignments: prefs.emailAssignments,
          }),
          ...(prefs.emailTaskReminders !== undefined && {
            emailTaskReminders: prefs.emailTaskReminders,
          }),
          ...(prefs.emailDocumentExpiry !== undefined && {
            emailDocumentExpiry: prefs.emailDocumentExpiry,
          }),
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      emailMentions: result.emailMentions,
      emailAssignments: result.emailAssignments,
      emailTaskReminders: result.emailTaskReminders,
      emailDocumentExpiry: result.emailDocumentExpiry,
    };
  },

  /**
   * Flag candidates inactive for >12 months via "retention-flagged" tag (GDPR-05).
   * Returns count of newly flagged candidates.
   */
  async flagInactiveCandidates(orgId: string): Promise<number> {
    return withTenantContext(orgId, async (tx) => {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Find candidates whose updatedAt is older than 12 months
      const inactiveCandidates = await tx
        .select({ id: candidates.id })
        .from(candidates)
        .where(
          and(
            eq(candidates.organizationId, orgId),
            lt(candidates.updatedAt, twelveMonthsAgo)
          )
        );

      if (inactiveCandidates.length === 0) return 0;

      // For each inactive candidate, check if they have any recent applications
      let flaggedCount = 0;
      for (const candidate of inactiveCandidates) {
        const recentApps = await tx
          .select({ id: candidateApplications.id })
          .from(candidateApplications)
          .where(
            and(
              eq(candidateApplications.candidateId, candidate.id),
              sql`${candidateApplications.updatedAt} >= ${twelveMonthsAgo}`
            )
          )
          .limit(1);

        if (recentApps.length > 0) continue;

        // Check if already tagged
        const existingTag = await tx
          .select({ id: applicationTags.id })
          .from(applicationTags)
          .innerJoin(
            candidateApplications,
            eq(applicationTags.applicationId, candidateApplications.id)
          )
          .where(
            and(
              eq(candidateApplications.candidateId, candidate.id),
              eq(applicationTags.label, "retention-flagged")
            )
          )
          .limit(1);

        if (existingTag.length > 0) continue;

        // Find an application for this candidate to tag
        const [app] = await tx
          .select({ id: candidateApplications.id })
          .from(candidateApplications)
          .where(eq(candidateApplications.candidateId, candidate.id))
          .limit(1);

        if (app) {
          await tx.insert(applicationTags).values({
            organizationId: orgId,
            applicationId: app.id,
            label: "retention-flagged",
            createdByUserId: "system",
          });
          flaggedCount++;
        }
      }

      return flaggedCount;
    });
  },
};
