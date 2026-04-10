export interface PublicApplyInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city?: string;
  cvFileId?: string;
  licenseTypes?: string[];
  hasCode95?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface PublicVacancyView {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  slug: string;
  requiredLicenses: string[] | null;
  organizationName: string;
  organizationLogo: string | null;
  createdAt: Date;
}
