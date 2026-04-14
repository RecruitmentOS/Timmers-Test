/**
 * Candidate - person-level data only.
 * No vacancy-specific fields (those are on CandidateApplication).
 */
export type AvailabilityType = "direct" | "opzegtermijn" | "in_overleg";
export type ContractType = "vast" | "tijdelijk" | "uitzend" | "zzp";

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
  availabilityType: AvailabilityType | null;
  availabilityStartDate: Date | null;
  contractType: ContractType | null;
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
  availabilityType?: AvailabilityType;
  availabilityStartDate?: string;
  contractType?: ContractType;
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
  availabilityType?: AvailabilityType | null;
  availabilityStartDate?: string | null;
  contractType?: ContractType | null;
}
