/**
 * Candidate - person-level data only.
 * No vacancy-specific fields (those are on CandidateApplication).
 */
export interface Candidate {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  latitude: string | null;
  longitude: string | null;
  geocodedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Input for creating a new candidate.
 */
export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
}

/**
 * Input for updating an existing candidate.
 */
export interface UpdateCandidateInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  source?: string | null;
}
