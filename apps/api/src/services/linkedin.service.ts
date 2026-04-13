// ============================================================
// LinkedIn Jobs API — Dormant stub
// LinkedIn Jobs API requires partnership approval. This service
// returns 503-style "dormant" responses so the UI can show a
// clear message while keeping the code ready for activation.
// ============================================================

const DORMANT_MESSAGE =
  "LinkedIn Jobs API vereist partnerschap-goedkeuring. Neem contact op met support om dit te activeren.";

export const linkedinService = {
  /**
   * Post a vacancy to LinkedIn Jobs. Currently dormant.
   */
  postVacancy(
    _orgId: string,
    _vacancyId: string
  ): { status: "dormant"; message: string } {
    return { status: "dormant", message: DORMANT_MESSAGE };
  },

  /**
   * Sync LinkedIn Apply Connect applications. Currently dormant.
   */
  syncApplies(
    _orgId: string
  ): { status: "dormant"; message: string } {
    return { status: "dormant", message: DORMANT_MESSAGE };
  },

  /**
   * Check if LinkedIn integration is available.
   */
  isAvailable(): boolean {
    return false;
  },

  /**
   * Process an incoming LinkedIn Apply Connect webhook payload.
   * Feature-flagged on LINKEDIN_WEBHOOK_SECRET env var.
   */
  async processWebhook(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    resumeUrl?: string;
    jobId: string;
  }): Promise<{ status: "dormant"; message: string }> {
    // When partnership is approved, this will:
    // 1. Validate webhook signature
    // 2. Create candidate from payload
    // 3. Create application with source='linkedin'
    // 4. Store resume from resumeUrl
    console.log(
      "[linkedin] Webhook received but integration dormant:",
      payload.email
    );
    return { status: "dormant", message: DORMANT_MESSAGE };
  },
};
