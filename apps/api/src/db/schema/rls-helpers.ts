import { pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Reference to the existing app_user PostgreSQL role.
 * RLS policies target this role so that superusers bypass RLS.
 */
export const appRole = pgRole("app_user").existing();

/**
 * Generates the 4 standard RLS policies for a tenant-scoped table.
 * Each policy checks organization_id against current_setting('app.tenant_id')::uuid.
 *
 * Uses sql.raw for the column name because drizzle-kit's DDL serialization
 * does not properly handle Drizzle column references in policy expressions.
 *
 * @param tableName - The SQL table name used as prefix for policy names
 */
export function tenantRlsPolicies(tableName: string) {
  const condition = sql`"organization_id" = current_setting('app.tenant_id')::uuid`;

  return [
    pgPolicy(`${tableName}_tenant_select`, {
      as: "permissive",
      to: appRole,
      for: "select",
      using: condition,
    }),
    pgPolicy(`${tableName}_tenant_insert`, {
      as: "permissive",
      to: appRole,
      for: "insert",
      withCheck: condition,
    }),
    pgPolicy(`${tableName}_tenant_update`, {
      as: "permissive",
      to: appRole,
      for: "update",
      using: condition,
      withCheck: condition,
    }),
    pgPolicy(`${tableName}_tenant_delete`, {
      as: "permissive",
      to: appRole,
      for: "delete",
      using: condition,
    }),
  ];
}
