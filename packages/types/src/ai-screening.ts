export type AIScreeningVerdict = "yes" | "maybe" | "no";

export type AIScreeningStatus = "pending" | "success" | "error";

export interface AIScreeningResult {
  verdict: AIScreeningVerdict;
  reasoning: string;
  confidence: number;
  matchedCriteria: string[];
  missingCriteria: string[];
}

export interface AIScreeningLog {
  id: string;
  organizationId: string;
  applicationId: string;
  vacancyId: string;
  candidateId: string;
  verdict: AIScreeningVerdict | null;
  reasoning: string | null;
  confidence: string | null;
  matchedCriteria: string[] | null;
  missingCriteria: string[] | null;
  inputTokens: number | null;
  outputTokens: number | null;
  modelId: string | null;
  durationMs: number | null;
  contentHash: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AIUsage {
  id: string;
  organizationId: string;
  monthKey: string;
  screeningCount: number;
  screeningTokens: number;
  parseCount: number;
  parseTokens: number;
  quotaLimit: number;
  quotaNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerScreeningInput {
  applicationId: string;
}

export interface AIScreeningResponse {
  screeningLogId: string;
  status: AIScreeningStatus;
  result?: AIScreeningResult;
  cached: boolean;
}
