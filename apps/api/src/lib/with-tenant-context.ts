import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

// UUID v4 format validation to prevent SQL injection in SET LOCAL
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wraps a database operation in a transaction with tenant context.
 *
 * Sets `app.tenant_id` as a transaction-local PostgreSQL variable
 * using SET LOCAL (not SET) so it's safe in connection-pooled environments.
 * RLS policies on tenant-scoped tables use current_setting('app.tenant_id')
 * to filter rows, ensuring cross-tenant data isolation.
 *
 * Note: SET LOCAL cannot use parameterized queries ($1), so the value
 * is embedded via sql.raw(). UUID format is strictly validated to
 * prevent SQL injection.
 *
 * @param organizationId - The tenant/organization UUID
 * @param fn - The database operation to execute within tenant context
 * @returns The result of the database operation
 */
export async function withTenantContext<T>(
  organizationId: string,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  if (!UUID_REGEX.test(organizationId)) {
    throw new Error(
      `Invalid organization ID format: ${organizationId}. Must be a valid UUID.`
    );
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL app.tenant_id = '${sql.raw(organizationId)}'`
    );
    return fn(tx as unknown as typeof db);
  });
}
