import Link from "next/link";
import type { Metadata } from "next";
import type { PublicVacancyView } from "@recruitment-os/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} - Vacatures`,
  };
}

export default async function JobListingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const lang = sp.lang === "en" ? "en" : "nl";

  const res = await fetch(`${API_BASE}/api/public/${slug}/jobs`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-800">
          {lang === "en" ? "Organization not found" : "Organisatie niet gevonden"}
        </h1>
      </div>
    );
  }

  const vacancies: PublicVacancyView[] = await res.json();

  const orgName = vacancies[0]?.organizationName || slug;
  const orgLogo = vacancies[0]?.organizationLogo;

  return (
    <div>
      {/* Organization header */}
      <div className="mb-8 text-center">
        {orgLogo && (
          <img
            src={orgLogo}
            alt={orgName}
            className="mx-auto mb-4 h-16 w-auto"
          />
        )}
        <h1 className="text-3xl font-bold text-gray-900">{orgName}</h1>
        <p className="mt-2 text-gray-600">
          {lang === "en" ? "Open positions" : "Vacatures"}
        </p>
      </div>

      {/* Vacancy list */}
      {vacancies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {lang === "en"
            ? "No vacancies available"
            : "Geen vacatures beschikbaar"}
        </div>
      ) : (
        <div className="space-y-4">
          {vacancies.map((vacancy) => (
            <Link
              key={vacancy.id}
              href={`/jobs/${slug}/${vacancy.slug}`}
              className="block rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {vacancy.title}
              </h2>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                {vacancy.location && (
                  <span className="flex items-center gap-1">
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
                  <span className="rounded-full bg-gray-100 px-3 py-0.5">
                    {vacancy.employmentType}
                  </span>
                )}
                <span className="text-gray-400">
                  {new Date(vacancy.createdAt).toLocaleDateString(
                    lang === "en" ? "en-GB" : "nl-NL"
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
