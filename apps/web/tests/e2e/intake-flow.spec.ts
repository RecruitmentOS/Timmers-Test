// apps/web/tests/e2e/intake-flow.spec.ts
//
// E2E happy-path test for the Fleks + WhatsApp intake flow.
//
// Prerequisites (when E2E_HAS_SEED is set):
//   - Dev server running on :3002 (Next.js) and :4000 (Hono API)
//   - DB seeded with a test candidate whose phone = +31600000001
//     and an intake_session in state `awaiting_first_reply`
//   - TWILIO_VERIFY_WEBHOOKS=false in the test environment
//   - Recruiter user provisioned (see tests/e2e/fixtures/test-users.ts)
//
// Fixture setup (steps 2-3 below) is deferred to a dedicated seed task.
// Those steps are marked test.fixme() until the seed is in place.

import { test, expect } from "./fixtures/auth.fixture";

// Phone number that must match a seeded intake_session in the test DB.
const INTAKE_PHONE = "whatsapp:+31600000001";
// API base — matches docker-compose / local dev convention.
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

test.describe("Fleks + WhatsApp intake — E2E happy path", () => {
  test(
    "full flow: Fleks candidate -> WhatsApp -> verdict",
    async ({ authenticatedPage: page, request }) => {
      // -----------------------------------------------------------------------
      // Step 1: Authenticate
      // The `authenticatedPage` fixture from auth.fixture.ts handles login via
      // the storageState pattern (re-uses persisted session, dormant-safe).
      // If the backend seed is absent the fixture writes an empty storageState
      // and downstream assertions either fail fast or are guarded by fixme.
      // -----------------------------------------------------------------------

      // -----------------------------------------------------------------------
      // Step 2: Seed — vacancy with intake enabled + criteria
      // TODO: Implement a seed API endpoint (test-only, e.g. POST /api/test/seed/intake)
      //       that creates a vacancy with fleks_intake_enabled=true and one
      //       intake_session in state `awaiting_first_reply` for +31600000001.
      //       Until that endpoint exists, this step is a no-op and step 3 also
      //       depends on a manually seeded DB.
      // -----------------------------------------------------------------------
      test.fixme(
        !process.env.E2E_HAS_SEED,
        "Steps 2-3 require a DB seed or test-only seed endpoint — see TODO in this file"
      );

      // -----------------------------------------------------------------------
      // Step 3: Trigger Fleks sync tick (optional — only needed when the
      //         intake_session is NOT pre-seeded directly in the DB).
      //         Kept as a commented-out call because the admin endpoint
      //         `POST /api/admin/fleks/sync-tick` is test-only and not yet
      //         wired.  Un-comment once the endpoint exists.
      // -----------------------------------------------------------------------
      // const syncResp = await request.post(`${API_BASE}/api/admin/fleks/sync-tick`);
      // expect(syncResp.status()).toBe(200);

      // -----------------------------------------------------------------------
      // Step 4: Simulate inbound WhatsApp webhook
      // Sends the same form payload that Twilio delivers on an inbound message.
      // TWILIO_VERIFY_WEBHOOKS must be false in the test environment.
      // -----------------------------------------------------------------------
      const webhookResp = await request.post(
        `${API_BASE}/api/webhooks/whatsapp/twilio`,
        {
          form: {
            From: INTAKE_PHONE,
            MessageSid: "SM_test_1",
            Body: "Ja ik heb CE en ben fulltime beschikbaar",
            NumMedia: "0",
          },
          headers: { "content-type": "application/x-www-form-urlencoded" },
        }
      );
      expect(webhookResp.status()).toBe(200);

      // -----------------------------------------------------------------------
      // Step 5: Intake Inbox — session should appear with state in_progress
      // -----------------------------------------------------------------------
      await page.goto("/intake");
      await expect(page.locator("text=in_progress")).toBeVisible({
        timeout: 15_000,
      });

      // -----------------------------------------------------------------------
      // Step 6: Open session detail — inbound message text must be visible
      // -----------------------------------------------------------------------
      await page.click("table tbody tr:first-child a");
      await expect(page.locator("text=Ja ik heb CE")).toBeVisible();
    }
  );
});
