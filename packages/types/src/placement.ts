/**
 * Placement - records agreed terms when a candidate is hired via an application.
 * One application can have zero or one placement.
 */
export interface Placement {
  id: string;
  organizationId: string;
  applicationId: string;
  candidateId: string;
  vacancyId: string;
  clientId: string | null;
  agreedRate: string | null;
  inlenersbeloning: boolean;
  startDate: Date | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new placement.
 */
export interface CreatePlacementInput {
  applicationId: string;
  agreedRate?: number;
  inlenersbeloning?: boolean;
  startDate?: string; // ISO date string
  notes?: string;
}

/**
 * Input for updating an existing placement.
 */
export interface UpdatePlacementInput {
  agreedRate?: number | null;
  inlenersbeloning?: boolean;
  startDate?: string | null;
  notes?: string | null;
}
