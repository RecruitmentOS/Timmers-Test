import { Hono } from "hono";
import type { AppEnv } from "../lib/app-env.js";
import { billingService, isStripeEnabled, getStripe } from "../services/billing.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";

// ============================================================
// Billing routes
// The webhook endpoint is PUBLIC (no auth) — must be mounted before
// auth middleware in index.ts. Usage + portal routes require auth.
// ============================================================

export const billingRoutes = new Hono<AppEnv>();

/**
 * POST /webhook — Stripe webhook handler
 * CRITICAL: Use c.req.text() for raw body (pitfall #1: body parsing breaks signature)
 * No auth middleware — Stripe signs the request.
 */
billingRoutes.post("/webhook", async (c) => {
  if (!isStripeEnabled()) {
    return c.json({ received: true, message: "Billing disabled" }, 200);
  }

  const stripe = getStripe()!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Billing] STRIPE_WEBHOOK_SECRET not set");
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  // CRITICAL: raw body for signature verification
  const body = await c.req.text();
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("[Billing] Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    await billingService.handleWebhookEvent(event);
  } catch (err) {
    console.error("[Billing] Webhook handler error:", err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }

  return c.json({ received: true }, 200);
});

/**
 * GET /usage — current usage summary with plan limits
 * Requires settings:read permission
 */
billingRoutes.get(
  "/usage",
  requirePermission("settings", "read"),
  async (c) => {
    const orgId = c.get("organizationId");
    const usage = await billingService.getUsageSummary(orgId);
    return c.json(usage);
  }
);

/**
 * POST /portal-session — create Stripe billing portal session
 * Requires settings:update permission
 */
billingRoutes.post(
  "/portal-session",
  requirePermission("settings", "update"),
  async (c) => {
    const orgId = c.get("organizationId");
    const body = await c.req.json<{ returnUrl: string }>();

    const url = await billingService.createPortalSession(
      orgId,
      body.returnUrl
    );

    if (!url) {
      return c.json(
        { url: null, message: "Billing not configured" },
        200
      );
    }

    return c.json({ url });
  }
);
