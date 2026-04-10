import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { organization } from "../db/schema/auth.js";
import { vacancies } from "../db/schema/vacancies.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import type { PublicVacancyView } from "@recruitment-os/types";

export const publicVacancyService = {
  /**
   * Resolve an organization by its slug.
   * Queries the `organization` table directly — NO RLS (Better Auth table).
   */
  async resolveOrgBySlug(slug: string) {
    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
      })
      .from(organization)
      .where(eq(organization.slug, slug));

    return rows[0] ?? null;
  },

  /**
   * Get all active vacancies for an organization (public listing).
   * Uses withTenantContext so RLS is applied.
   */
  async getActiveVacancies(orgId: string): Promise<PublicVacancyView[]> {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          description: vacancies.description,
          location: vacancies.location,
          employmentType: vacancies.employmentType,
          slug: vacancies.slug,
          requiredLicenses: vacancies.requiredLicenses,
          createdAt: vacancies.createdAt,
        })
        .from(vacancies)
        .where(
          and(eq(vacancies.status, "active"), isNull(vacancies.deletedAt))
        );

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        location: r.location,
        employmentType: r.employmentType,
        slug: r.slug ?? "",
        requiredLicenses: (r.requiredLicenses as string[] | null) ?? null,
        organizationName: "", // filled by caller
        organizationLogo: null,
        createdAt: r.createdAt,
      }));
    });
  },

  /**
   * Get a single vacancy by slug within an organization (public detail).
   */
  async getVacancyBySlug(
    orgId: string,
    vacancySlug: string
  ): Promise<PublicVacancyView | null> {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          description: vacancies.description,
          location: vacancies.location,
          employmentType: vacancies.employmentType,
          slug: vacancies.slug,
          requiredLicenses: vacancies.requiredLicenses,
          ownerId: vacancies.ownerId,
          createdAt: vacancies.createdAt,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.slug, vacancySlug),
            eq(vacancies.status, "active"),
            isNull(vacancies.deletedAt)
          )
        );

      const r = rows[0];
      if (!r) return null;

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        location: r.location,
        employmentType: r.employmentType,
        slug: r.slug ?? "",
        requiredLicenses: (r.requiredLicenses as string[] | null) ?? null,
        organizationName: "", // filled by caller
        organizationLogo: null,
        createdAt: r.createdAt,
      };
    });
  },
};
