/**
 * ApplicationTag — free-text label applied to a candidate_application
 * via the bulk-tag action (BULK-05). Mirrors the application_tags table 1:1.
 */
export interface ApplicationTag {
  id: string;
  organizationId: string;
  applicationId: string;
  label: string;
  createdByUserId: string;
  createdAt: string;
}
