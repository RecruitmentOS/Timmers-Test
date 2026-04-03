/**
 * All application roles available in Recruitment OS.
 * Maps to Better Auth custom roles via the organization plugin.
 */
export type AppRole =
  | "super_admin"
  | "agency_admin"
  | "recruiter"
  | "agent"
  | "hiring_manager"
  | "client_viewer"
  | "marketing_op";

export const APP_ROLES: readonly AppRole[] = [
  "super_admin",
  "agency_admin",
  "recruiter",
  "agent",
  "hiring_manager",
  "client_viewer",
  "marketing_op",
] as const;
