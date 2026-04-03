import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { organization, user } from "./schema/auth.js";
import { vacancies } from "./schema/vacancies.js";

const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TEST_USER_ID = "test-user-rls-isolation";

async function main() {
  console.log("Testing cross-tenant RLS isolation...\n");

  try {
    // Setup: insert test organizations and a test user directly (bypassing RLS as table owner)
    await db.insert(user).values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-rls@example.com",
      emailVerified: false,
    });

    await db.insert(organization).values([
      { id: ORG_A_ID, name: "Org A" },
      { id: ORG_B_ID, name: "Org B" },
    ]);

    // Insert vacancy for Org A using tenant context
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_A_ID)}'`
      );
      await tx.insert(vacancies).values({
        organizationId: ORG_A_ID,
        title: "Org A Vacancy",
        ownerId: TEST_USER_ID,
        status: "draft",
      });
    });

    // Insert vacancy for Org B using tenant context
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_B_ID)}'`
      );
      await tx.insert(vacancies).values({
        organizationId: ORG_B_ID,
        title: "Org B Vacancy",
        ownerId: TEST_USER_ID,
        status: "draft",
      });
    });

    // Query as Org A: should only see Org A vacancy
    const orgAResults = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_A_ID)}'`
      );
      return tx.select().from(vacancies);
    });

    console.log(`Org A query returned ${orgAResults.length} row(s):`);
    for (const row of orgAResults) {
      console.log(`  - ${row.title} (org: ${row.organizationId})`);
    }

    if (orgAResults.length !== 1 || orgAResults[0].title !== "Org A Vacancy") {
      console.error("\nFAIL: Org A should see exactly 1 vacancy (Org A Vacancy)");
      await cleanup();
      process.exit(1);
    }

    const orgAHasOrgBData = orgAResults.some(
      (r) => r.organizationId === ORG_B_ID
    );
    if (orgAHasOrgBData) {
      console.error("\nFAIL: Org A can see Org B data! RLS is broken.");
      await cleanup();
      process.exit(1);
    }

    // Query as Org B: should only see Org B vacancy
    const orgBResults = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_B_ID)}'`
      );
      return tx.select().from(vacancies);
    });

    console.log(`\nOrg B query returned ${orgBResults.length} row(s):`);
    for (const row of orgBResults) {
      console.log(`  - ${row.title} (org: ${row.organizationId})`);
    }

    if (orgBResults.length !== 1 || orgBResults[0].title !== "Org B Vacancy") {
      console.error("\nFAIL: Org B should see exactly 1 vacancy (Org B Vacancy)");
      await cleanup();
      process.exit(1);
    }

    const orgBHasOrgAData = orgBResults.some(
      (r) => r.organizationId === ORG_A_ID
    );
    if (orgBHasOrgAData) {
      console.error("\nFAIL: Org B can see Org A data! RLS is broken.");
      await cleanup();
      process.exit(1);
    }

    console.log("\nPASS: Cross-tenant RLS isolation verified.");
    console.log("  - Org A sees only Org A data");
    console.log("  - Org B sees only Org B data");
    console.log("  - Zero cross-tenant leakage");

    await cleanup();
    process.exit(0);
  } catch (err) {
    console.error("FAIL:", err);
    await cleanup().catch(() => {});
    process.exit(1);
  }
}

async function cleanup() {
  console.log("\nCleaning up test data...");
  // Delete vacancies within tenant context (RLS requires it)
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_A_ID)}'`);
    await tx.delete(vacancies).where(eq(vacancies.ownerId, TEST_USER_ID));
  });
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = '${sql.raw(ORG_B_ID)}'`);
    await tx.delete(vacancies).where(eq(vacancies.ownerId, TEST_USER_ID));
  });
  // Organization and user tables don't have RLS
  await db.delete(organization).where(eq(organization.id, ORG_A_ID));
  await db.delete(organization).where(eq(organization.id, ORG_B_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  console.log("Cleanup complete.");
}

main();
