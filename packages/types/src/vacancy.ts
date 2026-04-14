/**
 * Vacancy status values.
 */
export type VacancyStatus = "draft" | "active" | "paused" | "closed" | "archived";

/**
 * Vacancy - represents an open position to recruit for.
 */
export interface Vacancy {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  status: VacancyStatus;
  ownerId: string;
  clientId: string | null;
  qualificationCriteria: unknown | null;
  slug: string | null;
  latitude: string | null;
  longitude: string | null;
  geocodedAt: Date | null;
  requiredLicenses: string[] | null;
  distributionChannels: Record<string, boolean> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Input for creating a new vacancy.
 */
export interface CreateVacancyInput {
  title: string;
  description?: string;
  location?: string;
  employmentType?: string;
  status?: VacancyStatus;
  clientId?: string;
  qualificationCriteria?: unknown;
  slug?: string;
  requiredLicenses?: string[];
  distributionChannels?: Record<string, boolean>;
}

/**
 * Input for updating an existing vacancy.
 */
export interface UpdateVacancyInput {
  title?: string;
  description?: string;
  location?: string;
  employmentType?: string;
  status?: VacancyStatus;
  clientId?: string | null;
  qualificationCriteria?: unknown;
  slug?: string;
  requiredLicenses?: string[];
  distributionChannels?: Record<string, boolean>;
}
