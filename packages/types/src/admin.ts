/** Organization settings for the admin panel */
export interface OrgSettings {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  metadata: string | null;
}

/** Reusable qualification checklist preset */
export interface QualificationPreset {
  id: string;
  organizationId: string;
  name: string;
  criteria: string;
  isDefault: boolean;
  createdAt: string;
}

/** Pipeline stage configuration for admin management */
export interface PipelineStageConfig {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
}

/** Team member info for admin team management */
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
