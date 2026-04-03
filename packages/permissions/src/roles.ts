export const APP_ROLES = [
  "super_admin",
  "agency_admin",
  "recruiter",
  "agent",
  "hiring_manager",
  "client_viewer",
  "marketing_op",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
