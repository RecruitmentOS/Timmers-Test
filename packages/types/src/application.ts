/**
 * Qualification status for a candidate application.
 */
export type QualificationStatus = "pending" | "yes" | "maybe" | "no";

/**
 * CandidateApplication - one candidate's journey in one vacancy.
 * Separate from Candidate (person-level data).
 */
export interface CandidateApplication {
  id: string;
  organizationId: string;
  candidateId: string;
  vacancyId: string;
  currentStageId: string | null;
  ownerId: string;
  qualificationStatus: QualificationStatus;
  sourceDetail: string | null;
  campaignId: string | null;
  assignedAgentId: string | null;
  sentToClient: boolean;
  /** Employer-mode counterpart to sentToClient. Parallel boolean. */
  sentToHiringManager: boolean;
  /** Set when qualificationStatus is "no". Required for the reject flow. */
  rejectReason: string | null;
  /** Free-text notes captured in the qualification drawer. */
  qualificationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated list response for GET /api/applications.
 * Used by Plan 02-02 (backend) and Plan 02-04's SelectAllMatchingBanner
 * (so the frontend knows the "all matching" count vs. current-page count).
 */
export interface CandidateApplicationListResponse {
  rows: CandidateApplication[];
  total: number;
  pages: number;
  page: number;
  limit: number;
}

/**
 * Input for creating a new application.
 */
export interface CreateApplicationInput {
  candidateId: string;
  vacancyId: string;
  currentStageId?: string;
  sourceDetail?: string;
  campaignId?: string;
  assignedAgentId?: string;
}

/**
 * Input for updating an existing application.
 */
export interface UpdateApplicationInput {
  currentStageId?: string | null;
  qualificationStatus?: QualificationStatus;
  sourceDetail?: string | null;
  assignedAgentId?: string | null;
  sentToClient?: boolean;
}
