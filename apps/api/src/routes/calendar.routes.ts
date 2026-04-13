import { Hono } from "hono";
import type { AppEnv } from "../lib/app-env.js";
import {
  calendarService,
  isGoogleCalendarConfigured,
  isOutlookCalendarConfigured,
} from "../services/calendar.service.js";
import { errorResponse } from "../lib/errors.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3002";
const API_URL = process.env.API_URL || "http://localhost:4000";

export const calendarRoutes = new Hono<AppEnv>()
  /**
   * GET /google/auth — Returns Google OAuth consent URL
   */
  .get("/google/auth", async (c) => {
    if (!isGoogleCalendarConfigured()) {
      return c.json({ error: "Google Calendar niet geconfigureerd" }, 404);
    }

    const redirectUri = `${API_URL}/api/calendar/google/callback`;
    const authUrl = calendarService.getGoogleAuthUrl(redirectUri);
    if (!authUrl) {
      return c.json({ error: "Google Calendar niet geconfigureerd" }, 404);
    }

    return c.json({ authUrl });
  })

  /**
   * GET /google/callback — Handles Google OAuth callback
   */
  .get("/google/callback", async (c) => {
    try {
      const code = c.req.query("code");
      if (!code) {
        return c.redirect(`${FRONTEND_URL}/settings?error=missing_code`);
      }

      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const redirectUri = `${API_URL}/api/calendar/google/callback`;

      await calendarService.handleGoogleCallback(
        orgId,
        user.id,
        code,
        redirectUri
      );

      return c.redirect(
        `${FRONTEND_URL}/settings?calendar=connected&provider=google`
      );
    } catch (e) {
      console.error("[calendar] Google callback error:", e);
      return c.redirect(`${FRONTEND_URL}/settings?error=google_auth_failed`);
    }
  })

  /**
   * GET /outlook/auth — Returns Outlook OAuth consent URL
   */
  .get("/outlook/auth", async (c) => {
    if (!isOutlookCalendarConfigured()) {
      return c.json({ error: "Outlook Calendar niet geconfigureerd" }, 404);
    }

    const redirectUri = `${API_URL}/api/calendar/outlook/callback`;
    const authUrl = calendarService.getOutlookAuthUrl(redirectUri);
    if (!authUrl) {
      return c.json({ error: "Outlook Calendar niet geconfigureerd" }, 404);
    }

    return c.json({ authUrl });
  })

  /**
   * GET /outlook/callback — Handles Outlook OAuth callback
   */
  .get("/outlook/callback", async (c) => {
    try {
      const code = c.req.query("code");
      if (!code) {
        return c.redirect(`${FRONTEND_URL}/settings?error=missing_code`);
      }

      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const redirectUri = `${API_URL}/api/calendar/outlook/callback`;

      await calendarService.handleOutlookCallback(
        orgId,
        user.id,
        code,
        redirectUri
      );

      return c.redirect(
        `${FRONTEND_URL}/settings?calendar=connected&provider=outlook`
      );
    } catch (e) {
      console.error("[calendar] Outlook callback error:", e);
      return c.redirect(`${FRONTEND_URL}/settings?error=outlook_auth_failed`);
    }
  })

  /**
   * GET /connections — List user's calendar connections (no tokens)
   */
  .get("/connections", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const connections = await calendarService.listConnections(orgId, user.id);
      return c.json(connections);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * DELETE /connections/:id — Remove a calendar connection
   */
  .delete("/connections/:id", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const connectionId = c.req.param("id");
      await calendarService.deleteConnection(orgId, connectionId);
      return c.json({ deleted: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /providers — Returns which calendar providers are available
   */
  .get("/providers", async (c) => {
    return c.json({
      google: isGoogleCalendarConfigured(),
      outlook: isOutlookCalendarConfigured(),
    });
  });
