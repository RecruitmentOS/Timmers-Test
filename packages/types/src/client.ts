/**
 * Client - the company/employer that the agency fills positions for.
 */
export interface Client {
  id: string;
  organizationId: string;
  name: string;
  contactPerson: string | null;
  contactEmail: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Input for creating a new client.
 */
export interface CreateClientInput {
  name: string;
  contactPerson?: string;
  contactEmail?: string;
}

/**
 * Input for updating an existing client.
 */
export interface UpdateClientInput {
  name?: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  status?: string;
}
