export type CalendarProvider = "google" | "outlook";

export type InterviewStatus = "scheduled" | "completed" | "cancelled";

export interface CalendarConnection {
  id: string;
  organizationId: string;
  userId: string;
  provider: CalendarProvider;
  calendarEmail: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  organizationId: string;
  applicationId: string;
  vacancyId: string;
  candidateId: string;
  scheduledBy: string;
  calendarConnectionId: string | null;
  calendarEventId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  status: InterviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterviewInput {
  applicationId: string;
  vacancyId: string;
  candidateId: string;
  calendarConnectionId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  notes?: string;
}
