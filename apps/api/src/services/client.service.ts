import { eq, and, isNull, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  clients,
  clientVacancyAccess,
  clientUserAssignments,
  vacancies,
  activityLog,
} from "../db/schema/index.js";
import { auth } from "../auth.js";
import type { CreateClientInput, UpdateClientInput } from "@recruitment-os/types";

export const clientService = {
  async list(orgId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(sql`${clients.createdAt} DESC`);
    });
  },

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(clients)
        .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
      return rows[0] ?? null;
    });
  },

  async create(orgId: string, userId: string, data: CreateClientInput) {
    return withTenantContext(orgId, async (tx) => {
      const [client] = await tx
        .insert(clients)
        .values({
          organizationId: orgId,
          name: data.name,
          contactPerson: data.contactPerson ?? null,
          contactEmail: data.contactEmail ?? null,
        })
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "client",
        entityId: client.id,
        action: "created",
        actorId: userId,
        metadata: { name: client.name },
      });

      return client;
    });
  },

  async update(orgId: string, id: string, data: UpdateClientInput) {
    return withTenantContext(orgId, async (tx) => {
      const [client] = await tx
        .update(clients)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, id))
        .returning();

      if (client) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "client",
          entityId: id,
          action: "updated",
          actorId: client.name, // Will be passed properly from route
          metadata: { fields: Object.keys(data) },
        });
      }

      return client ?? null;
    });
  },

  async delete(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .update(clients)
        .set({ deletedAt: new Date() })
        .where(eq(clients.id, id));
    });
  },

  async addVacancyAccess(
    orgId: string,
    clientId: string,
    vacancyId: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      await tx.insert(clientVacancyAccess).values({
        organizationId: orgId,
        clientId,
        vacancyId,
      });
    });
  },

  async removeVacancyAccess(
    orgId: string,
    clientId: string,
    vacancyId: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .delete(clientVacancyAccess)
        .where(
          and(
            eq(clientVacancyAccess.clientId, clientId),
            eq(clientVacancyAccess.vacancyId, vacancyId)
          )
        );
    });
  },

  async getVacancyAccess(orgId: string, clientId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          status: vacancies.status,
          location: vacancies.location,
        })
        .from(clientVacancyAccess)
        .innerJoin(
          vacancies,
          eq(clientVacancyAccess.vacancyId, vacancies.id)
        )
        .where(eq(clientVacancyAccess.clientId, clientId));
    });
  },

  async assignUser(orgId: string, clientId: string, userId: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx.insert(clientUserAssignments).values({
        organizationId: orgId,
        clientId,
        userId,
      });
    });
  },

  async inviteClientUser(
    orgId: string,
    clientId: string,
    email: string
  ) {
    // Create user with client_viewer role using Better Auth admin API
    // Then assign them to the client and send a magic link
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password: crypto.randomUUID(), // Random password, user will use magic link
        name: email.split("@")[0],
      },
    });

    const userId = signUpResult.user?.id;
    if (!userId) {
      throw new Error("Failed to create user account");
    }

    // Add user as member of the organization with client_viewer role
    await auth.api.addMember({
      body: {
        organizationId: orgId,
        userId,
        role: "client_viewer",
      },
    });

    // Insert client user assignment
    await withTenantContext(orgId, async (tx) => {
      await tx.insert(clientUserAssignments).values({
        organizationId: orgId,
        clientId,
        userId,
      });
    });

    // Send magic link for passwordless access (signInMagicLink is the server API method)
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: "/portal",
      },
      headers: new Headers(),
    });

    return { userId, email };
  },

  async getAssignedUsers(orgId: string, clientId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(clientUserAssignments)
        .where(eq(clientUserAssignments.clientId, clientId));
    });
  },
};
