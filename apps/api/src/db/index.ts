import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

/**
 * Superuser connection that bypasses PostgreSQL RLS.
 *
 * Used for cross-tenant lookups where the tenant is not yet known —
 * e.g. resolving an API key before the org ID is available.
 *
 * In production: set DATABASE_ADMIN_URL to the postgres superuser connection.
 * In dev: falls back to DATABASE_URL (app_user). If dev uses app_user for
 * DATABASE_URL, set DATABASE_ADMIN_URL=postgresql://postgres:...@localhost:5433/...
 * so that RLS-bypassed lookups work correctly.
 */
const adminConnectionString =
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!;
const adminClient = postgres(adminConnectionString);
export const dbAdmin = drizzle(adminClient, { schema });
