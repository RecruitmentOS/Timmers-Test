// Production migration workflow:
// 1. Make schema changes in src/db/schema/
// 2. Run: pnpm db:generate (creates SQL migration in drizzle/)
// 3. Review generated SQL file
// 4. Run: pnpm db:migrate (applies migration + re-runs RLS)
//
// For dev: pnpm db:push still works for rapid iteration
// For production: ALWAYS use db:migrate (versioned, auditable)
//
// IMPORTANT: DATABASE_URL should point to the superuser connection (postgres role)
// for DDL operations. In production, set DATABASE_URL to the superuser connection
// for migrations only — the app itself should use app_user with RLS.

import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Load .env from monorepo root (same pattern as drizzle.config.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../../.env") });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Single connection for migrations — no pool needed
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    // Step 1: Apply versioned migrations from drizzle/ folder
    console.log("Applying database migrations...");
    await migrate(db, {
      migrationsFolder: resolve(__dirname, "../../drizzle"),
    });
    console.log("Migrations applied successfully");

    // Step 2: Re-apply RLS policies (must run after every migration)
    // RLS policies reference table columns that may change during migrations,
    // so they must be reapplied to stay in sync with the schema.
    console.log("Applying RLS policies...");
    const rlsScript = readFileSync(
      resolve(__dirname, "setup-rls.sql"),
      "utf-8"
    );
    await sql.unsafe(rlsScript);
    console.log("RLS policies applied successfully");

    console.log("Database migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
