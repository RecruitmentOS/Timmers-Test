// Subset of Fleks V2 External API shapes we consume. Expand as needed.

export interface FleksJob {
  uuid: string;
  functionName: string;
  functionDescription: string | null;
  clientName: string | null;
  clientId: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  categoryUUIDS: string[];
  isArchived: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface FleksEmployee {
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  city: string | null;
  postCode: string | null;
  dateCreated: string;
  updatedAt: string;
  isRegistrationCompleted: boolean;
  isVerified: boolean;
  userRole: "Planner" | "Manager" | "Client" | "Worker";
}

export interface FleksJobCandidate extends FleksEmployee {
  jobUUID: string;
  isQualified: boolean;
  isInvited: boolean;
  isAlreadyScheduled: boolean;
  hasActiveContract: boolean;
}

export interface FleksPaginatedResponse<T> {
  data: T[];
  totalCount?: number;
  page: number;
  limit: number;
}
