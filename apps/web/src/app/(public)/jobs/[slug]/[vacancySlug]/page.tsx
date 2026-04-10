import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PublicVacancyView } from "@recruitment-os/types";
import { ApplyForm } from "./apply-form";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PageProps {
  params: Promise<{ slug: string; vacancySlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

async function getVacancy(
  slug: string,
  vacancySlug: string
): Promise<PublicVacancyView | null> {
  const res = await fetch(
    `${API_BASE}/api/public/${slug}/jobs/${vacancySlug}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, vacancySlug } = await params;
  const vacancy = await getVacancy(slug, vacancySlug);

  if (!vacancy) {
    return { title: "Vacancy not found" };
  }

  const description = vacancy.description
    ? vacancy.description.replace(/<[^>]*>/g, "").slice(0, 160)
    : undefined;

  return {
    title: vacancy.title,
    description,
  };
}

/** Map internal employment type to Schema.org values */
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

export default async function VacancyDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, vacancySlug } = await params;
  const sp = await searchParams;
  const lang = sp.lang === "en" ? "en" : "nl";

  const vacancy = await getVacancy(slug, vacancySlug);

  if (!vacancy) {
    notFound();
  }

  const requiredLicenses = vacancy.requiredLicenses ?? [];

  // Schema.org JobPosting JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: vacancy.title,
    description: vacancy.description ?? "",
    datePosted: new Date(vacancy.createdAt).toISOString().split("T")[0],
    employmentType: mapEmploymentType(vacancy.employmentType),
    hiringOrganization: {
      "@type": "Organization",
      name: vacancy.organizationName,
      ...(vacancy.organizationLogo ? { logo: vacancy.organizationLogo } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: vacancy.location ?? "",
        addressCountry: "NL",
      },
    },
    directApply: true,
  };

  return (
    <div>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Organization branding */}
      <div className="mb-6">
        {vacancy.organizationLogo && (
          <img
            src={vacancy.organizationLogo}
            alt={vacancy.organizationName}
            className="mb-4 h-12 w-auto"
          />
        )}
        <p className="text-sm text-gray-500">{vacancy.organizationName}</p>
      </div>

      {/* Vacancy details */}
      <h1 className="text-3xl font-bold text-gray-900">{vacancy.title}</h1>

      <div className="mt-4 flex flex-wrap gap-3">
        {vacancy.location && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {vacancy.location}
          </span>
        )}
        {vacancy.employmentType && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
            {vacancy.employmentType}
          </span>
        )}
        {requiredLicenses.map((license: string) => (
          <span
            key={license}
            className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700"
          >
            {lang === "en" ? "License" : "Rijbewijs"} {license}
          </span>
        ))}
      </div>

      {/* Description */}
      {vacancy.description && (
        <div
          className="prose prose-gray mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: vacancy.description }}
        />
      )}

      {/* Divider */}
      <hr className="my-10 border-gray-200" />

      {/* Apply form */}
      <h2 className="mb-6 text-2xl font-bold text-gray-900">
        {lang === "en" ? "Apply now" : "Nu solliciteren"}
      </h2>
      <ApplyForm slug={slug} vacancySlug={vacancySlug} lang={lang} />
    </div>
  );
}
