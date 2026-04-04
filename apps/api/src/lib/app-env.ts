/**
 * Hono environment type for the application.
 * Used by all route files to get typed access to context variables
 * set by auth and tenant middleware.
 */
export type AppEnv = {
  Variables: {
    user: {
      id: string;
      name: string;
      email: string;
      role?: string;
      [key: string]: unknown;
    } | null;
    session: {
      id: string;
      userId: string;
      activeOrganizationId?: string;
      [key: string]: unknown;
    } | null;
    organizationId: string;
  };
};
