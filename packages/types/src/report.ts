export interface ReportParams {
  vacancyId?: string;
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
}

export interface TotalCandidatesReport {
  vacancyId: string;
  vacancyTitle: string;
  total: number;
}

export interface QualifiedCandidatesReport {
  vacancyId: string;
  vacancyTitle: string;
  qualified: number;
  maybe: number;
  rejected: number;
}

export interface FunnelStage {
  stageId: string;
  stageName: string;
  count: number;
  conversionRate: number;  // percentage from previous stage
}

export interface StageFunnelReport {
  vacancyId: string;
  vacancyTitle: string;
  stages: FunnelStage[];
}

export interface TimeToFirstContactReport {
  vacancyId: string;
  vacancyTitle: string;
  avgHours: number;
  medianHours: number;
}

export interface SourceBreakdownEntry {
  source: string;
  count: number;
  percentage: number;
}

export interface SourceBreakdownReport {
  entries: SourceBreakdownEntry[];
}

export interface OwnerActivityReport {
  userId: string;
  userName: string;
  candidatesProcessed: number;
  tasksCompleted: number;
  qualificationsGiven: number;
}

export type ReportName =
  | "total-candidates"
  | "qualified-candidates"
  | "stage-funnel"
  | "time-to-first-contact"
  | "source-breakdown"
  | "owner-activity";
