export type LicenseType = 'B' | 'C' | 'CE' | 'D' | 'D1' | 'taxi';
export type QualificationType = LicenseType | 'code95' | 'adr' | 'digitachograaf';
export type AdrType = 'basis' | 'tank' | 'klasse1' | 'klasse7';

export interface DriverQualification {
  id: string;
  organizationId: string;
  candidateId: string;
  type: QualificationType;
  adrType: AdrType | null;
  cardNumber: string | null;
  issuedAt: string | null; // ISO date
  expiresAt: string | null; // ISO date
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDriverQualificationInput {
  candidateId: string;
  type: QualificationType;
  adrType?: AdrType;
  cardNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface LicenseBadge {
  type: QualificationType;
  expired: boolean;
  expiresAt: string | null;
}
