// Covers TEST-02 + 04-distribution-intake — public candidate apply flow
import { test, expect } from "@playwright/test";
import path from "node:path";
import { ApplyPage } from "../pages/apply.page";
import { CANDIDATE } from "../fixtures/test-users";

test.describe.configure({ mode: "parallel" });

const VACANCY_ID = process.env.E2E_APPLY_VACANCY_ID ?? "demo-vacancy-001";
const CV_PATH = path.resolve(__dirname, "..", "fixtures", "files", "sample-cv.pdf");

test.describe("Public apply flow", () => {
  test("candidate submits apply form with CV and sees success", async ({ page }) => {
    // TODO seed: requires vacancy `demo-vacancy-001` to exist and be published.
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded public vacancy — run apps/api/scripts/seed-demo-vacancy.ts"
    );
    const apply = new ApplyPage(page);
    await apply.goto(VACANCY_ID);
    await apply.fillCandidate(CANDIDATE);
    await apply.uploadCV(CV_PATH);
    await apply.submit();
    await apply.expectSuccess();
  });

  test("missing required field blocks submit", async ({ page }) => {
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded public vacancy to render the apply form at all"
    );
    const apply = new ApplyPage(page);
    await apply.goto(VACANCY_ID);
    // Fill everything EXCEPT email
    await apply.fillCandidate({ ...CANDIDATE, email: "" });
    await apply.submit();
    await apply.expectValidationError();
    // URL should still be on the apply page (no navigation)
    await expect(page).toHaveURL(new RegExp(`/apply/${VACANCY_ID}`));
  });
});
