export interface CVParseResult {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  workExperienceSummary?: string;
  languages?: string[];
  licenseTypes?: string[]; // from LicenseType
  hasCode95?: boolean;
  code95Expiry?: string; // ISO date
  hasADR?: boolean;
  adrType?: string;
  drivingExperienceYears?: number;
}

export type CVParseStatus = 'pending' | 'processing' | 'success' | 'error';

export interface CVParseLog {
  id: string;
  organizationId: string;
  fileId: string;
  candidateId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  modelId: string | null;
  durationMs: number | null;
  status: string;
  errorMessage: string | null;
  parsedData: CVParseResult | null;
  contentHash: string | null;
  createdAt: Date;
}
