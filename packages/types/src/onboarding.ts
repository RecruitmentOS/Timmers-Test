/** Input for the self-service onboarding wizard */
export interface OnboardingInput {
  orgName: string;
  mode: "agency" | "employer";
  primaryLocation: string;
  expectedUserCount: number;
}

/** Result returned after onboarding completes */
export interface OnboardingResult {
  organizationId: string;
  subdomain: string;
  mode: "agency" | "employer";
  trialEndsAt: string;
}
