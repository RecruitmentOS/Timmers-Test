import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { calendarConnections } from "../db/schema/calendar-connections.js";
import {
  encryptToken,
  decryptToken,
  isEncryptionConfigured,
} from "../lib/token-encryption.js";

// ============================================================
// Calendar OAuth service — Google + Outlook
// Encrypted token storage via shared AES-256-GCM utility.
// Feature-flagged: hidden when GOOGLE_CLIENT_ID / AZURE_CLIENT_ID not set.
// ============================================================

// --- Google OAuth ---

function getGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret);
}

export function isGoogleCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function isOutlookCalendarConfigured(): boolean {
  return !!process.env.AZURE_CLIENT_ID && !!process.env.AZURE_CLIENT_SECRET && !!process.env.AZURE_TENANT_ID;
}

// --- Outlook/Azure MSAL ---

function getMsalClient(): ConfidentialClientApplication | null {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!clientId || !clientSecret || !tenantId) return null;

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  });
}

// --- Types ---

interface CalendarEvent {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[]; // email addresses
}

// ============================================================
// Service
// ============================================================

export const calendarService = {
  // --- Google ---

  getGoogleAuthUrl(redirectUri: string): string | null {
    const client = getGoogleOAuth2Client();
    if (!client) return null;

    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      redirect_uri: redirectUri,
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });
  },

  async handleGoogleCallback(
    orgId: string,
    userId: string,
    code: string,
    redirectUri: string
  ) {
    const client = getGoogleOAuth2Client();
    if (!client) throw new Error("Google Calendar not configured");

    client.redirectUri = redirectUri;
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to obtain Google tokens");
    }

    // Get user email from token info
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const calendarEmail = userInfo.data.email ?? null;

    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

    // Upsert — one connection per user per provider
    const existing = await db
      .select({ id: calendarConnections.id })
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.organizationId, orgId),
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, "google")
        )
      );

    if (existing.length > 0) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          calendarEmail,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, existing[0].id));
      return existing[0].id;
    }

    const [row] = await db
      .insert(calendarConnections)
      .values({
        organizationId: orgId,
        userId,
        provider: "google",
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        calendarEmail,
      })
      .returning({ id: calendarConnections.id });

    return row.id;
  },

  async createGoogleEvent(connectionId: string, event: CalendarEvent) {
    const conn = await getConnectionById(connectionId);
    if (!conn || conn.provider !== "google") {
      throw new Error("Google calendar connection not found");
    }

    const client = getGoogleOAuth2Client();
    if (!client) throw new Error("Google Calendar not configured");

    const accessToken = decryptToken(conn.accessTokenEncrypted);
    const refreshToken = decryptToken(conn.refreshTokenEncrypted);

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-refresh on expiry
    client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await db
          .update(calendarConnections)
          .set({
            accessTokenEncrypted: encryptToken(newTokens.access_token),
            tokenExpiresAt: newTokens.expiry_date
              ? new Date(newTokens.expiry_date)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(calendarConnections.id, connectionId));
      }
    });

    const calendar = google.calendar({ version: "v3", auth: client });

    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: "Europe/Amsterdam",
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: "Europe/Amsterdam",
        },
        attendees: event.attendees?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 15 }],
        },
      },
      sendUpdates: "all",
    });

    return result.data.id ?? null;
  },

  async refreshGoogleToken(connectionId: string) {
    const conn = await getConnectionById(connectionId);
    if (!conn || conn.provider !== "google") return;

    const client = getGoogleOAuth2Client();
    if (!client) return;

    const refreshToken = decryptToken(conn.refreshTokenEncrypted);
    client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEncrypted: encryptToken(credentials.access_token),
          tokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, connectionId));
    }
  },

  // --- Outlook ---

  getOutlookAuthUrl(redirectUri: string): string | null {
    const clientId = process.env.AZURE_CLIENT_ID;
    const tenantId = process.env.AZURE_TENANT_ID;
    if (!clientId || !tenantId) return null;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "openid profile email Calendars.ReadWrite offline_access",
      response_mode: "query",
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async handleOutlookCallback(
    orgId: string,
    userId: string,
    code: string,
    redirectUri: string
  ) {
    const msalClient = getMsalClient();
    if (!msalClient) throw new Error("Outlook Calendar not configured");

    const result = await msalClient.acquireTokenByCode({
      code,
      redirectUri,
      scopes: ["Calendars.ReadWrite", "offline_access"],
    });

    if (!result.accessToken) {
      throw new Error("Failed to obtain Outlook tokens");
    }

    // Get user email from Graph
    const graphClient = Client.init({
      authProvider: (done) => done(null, result.accessToken),
    });
    const me = await graphClient.api("/me").select("mail,userPrincipalName").get();
    const calendarEmail = me.mail ?? me.userPrincipalName ?? null;

    const accessTokenEncrypted = encryptToken(result.accessToken);
    // MSAL doesn't directly expose refresh token — we store the access token
    // and rely on MSAL's token cache for refresh. Store empty encrypted placeholder.
    const refreshTokenEncrypted = encryptToken(
      result.accessToken // Use access token as refresh placeholder; MSAL handles refresh internally
    );

    // Upsert
    const existing = await db
      .select({ id: calendarConnections.id })
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.organizationId, orgId),
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, "outlook")
        )
      );

    if (existing.length > 0) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt: result.expiresOn ?? null,
          calendarEmail,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, existing[0].id));
      return existing[0].id;
    }

    const [row] = await db
      .insert(calendarConnections)
      .values({
        organizationId: orgId,
        userId,
        provider: "outlook",
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: result.expiresOn ?? null,
        calendarEmail,
      })
      .returning({ id: calendarConnections.id });

    return row.id;
  },

  async createOutlookEvent(connectionId: string, event: CalendarEvent) {
    const conn = await getConnectionById(connectionId);
    if (!conn || conn.provider !== "outlook") {
      throw new Error("Outlook calendar connection not found");
    }

    const accessToken = decryptToken(conn.accessTokenEncrypted);

    const graphClient = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    const graphEvent = {
      subject: event.summary,
      body: {
        contentType: "Text" as const,
        content: event.description ?? "",
      },
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: "Europe/Amsterdam",
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: "Europe/Amsterdam",
      },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: event.attendees?.map((email) => ({
        emailAddress: { address: email },
        type: "required" as const,
      })),
      isOnlineMeeting: false,
    };

    const result = await graphClient.api("/me/events").post(graphEvent);
    return result.id ?? null;
  },

  async refreshOutlookToken(connectionId: string) {
    const conn = await getConnectionById(connectionId);
    if (!conn || conn.provider !== "outlook") return;

    const msalClient = getMsalClient();
    if (!msalClient) return;

    // MSAL handles token refresh via its internal cache
    // For a more robust solution, we'd store the refresh token separately
    // For now, the user will need to re-authenticate if the token expires
    console.log(
      "[calendar] Outlook token refresh requested for connection:",
      connectionId
    );
  },

  // --- Shared ---

  async listConnections(
    orgId: string,
    userId: string
  ): Promise<
    Array<{
      id: string;
      provider: string;
      calendarEmail: string | null;
      createdAt: Date;
    }>
  > {
    const rows = await db
      .select({
        id: calendarConnections.id,
        provider: calendarConnections.provider,
        calendarEmail: calendarConnections.calendarEmail,
        createdAt: calendarConnections.createdAt,
      })
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.organizationId, orgId),
          eq(calendarConnections.userId, userId)
        )
      );

    return rows;
  },

  async deleteConnection(orgId: string, connectionId: string) {
    await db
      .delete(calendarConnections)
      .where(
        and(
          eq(calendarConnections.id, connectionId),
          eq(calendarConnections.organizationId, orgId)
        )
      );
  },

  /**
   * Create a calendar event using the appropriate provider.
   * Routes to Google or Outlook based on connection provider.
   */
  async createEvent(
    connectionId: string,
    eventData: CalendarEvent
  ): Promise<string | null> {
    const conn = await getConnectionById(connectionId);
    if (!conn) throw new Error("Calendar connection not found");

    if (conn.provider === "google") {
      return calendarService.createGoogleEvent(connectionId, eventData);
    }
    if (conn.provider === "outlook") {
      return calendarService.createOutlookEvent(connectionId, eventData);
    }

    throw new Error(`Unsupported calendar provider: ${conn.provider}`);
  },
};

// --- Internal helpers ---

async function getConnectionById(id: string) {
  const rows = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, id));
  return rows[0] ?? null;
}
