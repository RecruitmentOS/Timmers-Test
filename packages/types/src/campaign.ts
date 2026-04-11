/** Campaign statuses */
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignChannel =
  | "meta"
  | "indeed"
  | "google"
  | "linkedin"
  | "manual";

export interface Campaign {
  id: string;
  organizationId: string;
  vacancyId: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  budgetCents: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  spendCents: number;
  clicks: number;
  impressions: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  vacancyId: string;
  name: string;
  channel: CampaignChannel;
  budgetCents?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
  budgetCents?: number;
  startDate?: string;
  endDate?: string;
  spendCents?: number;
  clicks?: number;
  impressions?: number;
}

/** Targeting spec mirrors Meta Targeting object */
export interface TargetingSpec {
  geoLocations: {
    countries?: string[];
    regions?: { key: string }[];
    cities?: { key: string; radius: number; distanceUnit: string }[];
  };
  locales?: number[];
  interests?: { id: string; name: string }[];
}

export interface TargetingTemplate {
  id: string;
  organizationId: string;
  name: string;
  targetingSpec: TargetingSpec;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTargetingTemplateInput {
  name: string;
  targetingSpec: TargetingSpec;
}

export interface PersonaTemplate {
  id: string;
  organizationId: string;
  vacancyId: string | null;
  name: string;
  candidateCriteria: Record<string, unknown>;
  targetingTemplateId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaTemplateInput {
  vacancyId?: string;
  name: string;
  candidateCriteria: Record<string, unknown>;
  targetingTemplateId?: string;
}

export interface CampaignDailyMetric {
  id: string;
  campaignId: string;
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  reach: number;
  actions: Record<string, unknown> | null;
}

/** Dashboard aggregation (CAMP-04) */
export interface CampaignDashboardMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  applications: number;
  qualified: number;
  hired: number;
  costPerApplication: number | null;
  costPerQualified: number | null;
  costPerHire: number | null;
}

export interface MetaConnection {
  id: string;
  organizationId: string;
  metaAdAccountId: string;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  // NOTE: accessTokenEncrypted is NEVER returned to client
}
