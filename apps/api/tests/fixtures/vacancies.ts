/**
 * Realistic Dutch transport vacancy fixtures for testing.
 * Contains driver-specific fields: required licenses, salary ranges, transport locations.
 */

export interface VacancyFixture {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  city: string;
  status: string;
  employmentType: string;
  requiredLicenses: string[];
  qualificationCriteria: Record<string, unknown>;
  salaryMin: number | null;
  salaryMax: number | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createVacancyFixture(
  overrides: Partial<VacancyFixture> = {}
): VacancyFixture {
  return {
    id: "v0000000-0000-0000-0000-000000000001",
    organizationId: "a0000000-0000-0000-0000-000000000001",
    title: "CE Chauffeur Distributie",
    description:
      "Wij zoeken een ervaren CE chauffeur voor distributiewerk in de regio Rotterdam. Rijbewijs CE en code 95 vereist.",
    city: "Rotterdam",
    status: "active",
    employmentType: "fulltime",
    requiredLicenses: ["CE", "code95"],
    qualificationCriteria: {
      minimumExperience: "2 jaar",
      requiredCertificates: ["code95", "ADR basis"],
      physicalRequirements: "In staat om te laden en lossen",
    },
    salaryMin: 2800,
    salaryMax: 3400,
    ownerId: "u0000000-0000-0000-0000-000000000001",
    createdAt: new Date("2026-01-10"),
    updatedAt: new Date("2026-01-10"),
    ...overrides,
  };
}

/** CE distribution driver in Rotterdam */
export const ceDistributieVacancy = createVacancyFixture();

/** C driver for long-haul in Venlo */
export const cLongHaulVacancy = createVacancyFixture({
  id: "v0000000-0000-0000-0000-000000000002",
  title: "Vrachtwagenchauffeur C",
  description:
    "Internationaal transport vanuit Venlo. Rijbewijs C, code 95 en ADR verplicht.",
  city: "Venlo",
  requiredLicenses: ["C", "code95", "ADR"],
  qualificationCriteria: {
    minimumExperience: "3 jaar internationaal",
    requiredCertificates: ["code95", "ADR volledig"],
    languages: ["Nederlands", "Engels"],
  },
  salaryMin: 3000,
  salaryMax: 3800,
});

/** Warehouse/distribution driver near Schiphol */
export const schipholLogisticsVacancy = createVacancyFixture({
  id: "v0000000-0000-0000-0000-000000000003",
  title: "Chauffeur Luchtvracht Schiphol",
  description:
    "Luchtvrachtvervoer rondom Schiphol. Rijbewijs CE, code 95 en luchthavenpas vereist.",
  city: "Schiphol",
  requiredLicenses: ["CE", "code95"],
  qualificationCriteria: {
    minimumExperience: "1 jaar",
    requiredCertificates: ["code95"],
    special: "Luchthavenpas vereist",
  },
  salaryMin: 3200,
  salaryMax: 3600,
});

/** Vacancy with no specific license requirements */
export const noLicenseVacancy = createVacancyFixture({
  id: "v0000000-0000-0000-0000-000000000004",
  title: "Logistiek Medewerker",
  description: "Magazijnwerk en incidenteel bezorgwerk met bedrijfsbusje.",
  city: "Eindhoven",
  requiredLicenses: [],
  qualificationCriteria: {},
  salaryMin: 2400,
  salaryMax: 2800,
});
