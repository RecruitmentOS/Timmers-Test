// Covers TEST-02 + 07-ai-layer-polish — AI screening verdict on candidate
// AI route is mocked with page.route() so the test does NOT depend on
// ANTHROPIC_API_KEY being set.
import { test, expect } from "../fixtures/auth.fixture";
import { AiScreeningPage } from "../pages/ai-screening.page";

test.describe.configure({ mode: "parallel" });

const CANDIDATE_ID = process.env.E2E_CANDIDATE_ID ?? "cand-screen-test-001";

test.describe("AI screening", () => {
  test("recruiter runs AI screening on a candidate and sees verdict", async ({ authenticatedPage: page }) => {
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded candidate + application — see tests/e2e/README.md"
    );
    // Network mock: screening endpoint returns a deterministic verdict so the
    // test works without live Anthropic API credentials (dormant-safe).
    await page.route("**/api/ai/screening/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verdict: "go",
          reasoning: [
            "Kandidaat heeft CE-rijbewijs en Code 95.",
            "5 jaar ervaring in distributievervoer.",
            "Woont binnen 25km van werklocatie.",
          ],
        }),
      })
    );

    const screening = new AiScreeningPage(page);
    await screening.gotoCandidate(CANDIDATE_ID);
    await screening.clickRunScreening();
    await screening.expectVerdict();
    await screening.expectReasoningVisible();
  });
});
