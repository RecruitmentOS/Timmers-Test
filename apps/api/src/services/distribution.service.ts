import { eq, and, isNull } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { vacancies } from "../db/schema/index.js";
import type { DistributionChannels } from "@recruitment-os/types";

/** Escape XML special characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Map internal employment type to Indeed-compatible values */
function mapEmploymentType(type: string | null): string {
  switch (type?.toLowerCase()) {
    case "fulltime":
    case "full-time":
    case "full_time":
      return "FULL_TIME";
    case "parttime":
    case "part-time":
    case "part_time":
      return "PART_TIME";
    case "contract":
      return "CONTRACTOR";
    case "temporary":
    case "temp":
      return "TEMPORARY";
    case "internship":
      return "INTERN";
    default:
      return "FULL_TIME";
  }
}

export const distributionService = {
  /**
   * Generate Indeed-compatible XML feed for active vacancies.
   * Only includes vacancies where distributionChannels.indeed !== false
   * (default to included if distributionChannels is null).
   */
  async generateIndeedXml(
    orgId: string,
    orgName: string,
    orgSlug: string
  ): Promise<string> {
    const rows = await withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(vacancies)
        .where(
          and(eq(vacancies.status, "active"), isNull(vacancies.deletedAt))
        );
    });

    // Filter by distribution channel
    const filteredRows = rows.filter((v) => {
      const channels = v.distributionChannels as DistributionChannels | null;
      // Default to included if no channels set or indeed not explicitly false
      return channels === null || channels.indeed !== false;
    });

    const jobsXml = filteredRows
      .map((v) => {
        const jobUrl = `https://${orgSlug}.recruitment-os.nl/jobs/${v.slug || v.id}?source=Indeed`;
        const dateStr = v.createdAt.toISOString().split("T")[0];

        return `  <job>
    <title><![CDATA[${v.title}]]></title>
    <date><![CDATA[${dateStr}]]></date>
    <referencenumber><![CDATA[${v.id}]]></referencenumber>
    <url><![CDATA[${jobUrl}]]></url>
    <company><![CDATA[${escapeXml(orgName)}]]></company>
    <city><![CDATA[${v.location || ""}]]></city>
    <country><![CDATA[NL]]></country>
    <description><![CDATA[${v.description || ""}]]></description>
    <jobtype><![CDATA[${mapEmploymentType(v.employmentType)}]]></jobtype>
  </job>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher><![CDATA[${escapeXml(orgName)}]]></publisher>
  <publisherurl><![CDATA[https://${orgSlug}.recruitment-os.nl]]></publisherurl>
  <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
${jobsXml}
</source>`;
  },

  /**
   * Generate Marktplaats-compatible CSV export for active vacancies.
   * Only includes vacancies where distributionChannels.marktplaats !== false.
   * Includes UTF-8 BOM for Excel compatibility.
   */
  async generateMarktplaatsCsv(
    orgId: string,
    orgSlug: string
  ): Promise<string> {
    const rows = await withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(vacancies)
        .where(
          and(eq(vacancies.status, "active"), isNull(vacancies.deletedAt))
        );
    });

    // Filter by distribution channel
    const filteredRows = rows.filter((v) => {
      const channels = v.distributionChannels as DistributionChannels | null;
      return channels === null || channels.marktplaats !== false;
    });

    // UTF-8 BOM for Excel
    const BOM = "\uFEFF";
    const header = "Title,Description,Location,URL,Type,Company";

    const csvRows = filteredRows.map((v) => {
      const url = `https://${orgSlug}.recruitment-os.nl/jobs/${v.slug || v.id}?source=Marktplaats`;
      const desc = (v.description || "").replace(/"/g, '""').replace(/\n/g, " ");
      const title = (v.title || "").replace(/"/g, '""');
      const location = (v.location || "").replace(/"/g, '""');
      const type = mapEmploymentType(v.employmentType);

      return `"${title}","${desc}","${location}","${url}","${type}","${orgSlug}"`;
    });

    return BOM + [header, ...csvRows].join("\n");
  },
};
