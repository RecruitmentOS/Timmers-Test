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
  createdAt: Date;
  updatedAt: Date;
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
