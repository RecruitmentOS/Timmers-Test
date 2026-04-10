export type DocumentType = 'cv' | 'license' | 'code95' | 'adr' | 'id' | 'other';

export interface CandidateDocument {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  s3Key: string;
  documentType: DocumentType | null;
  expiresAt: string | null; // ISO date
  contentHash: string | null;
  uploadedBy: string;
  createdAt: Date;
}

export interface DocumentExpiryReminder {
  documentId: string;
  candidateId: string;
  orgId: string;
  daysUntilExpiry: number;
}
