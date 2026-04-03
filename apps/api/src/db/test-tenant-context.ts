import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

import { sql } from "drizzle-orm";
import { db } from "./index.js";

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  console.log("Testing withTenantContext...");

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SET LOCAL app.tenant_id = '${sql.raw(TEST_TENANT_ID)}'`
      );
      const rows = await tx.execute<{ current_setting: string }>(
        sql`SELECT current_setting('app.tenant_id') as current_setting`
      );
      return rows;
    });

    const settingValue = result[0]?.current_setting;
    if (settingValue !== TEST_TENANT_ID) {
      console.error(
        `FAIL: Expected current_setting = '${TEST_TENANT_ID}', got '${settingValue}'`
      );
      process.exit(1);
    }

    console.log(
      `PASS: current_setting('app.tenant_id') = '${settingValue}'`
    );
    process.exit(0);
  } catch (err) {
    console.error("FAIL:", err);
    process.exit(1);
  }
}

main();
