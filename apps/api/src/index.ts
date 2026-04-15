import "./instrument.js";
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { auth } from "./auth.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { tenantMiddleware } from "./middleware/tenant.middleware.js";
import { vacancyRoutes } from "./routes/vacancy.routes.js";
import { candidateRoutes } from "./routes/candidate.routes.js";
import { applicationRoutes } from "./routes/application.routes.js";
import { pipelineRoutes } from "./routes/pipeline.routes.js";
import { clientRoutes } from "./routes/client.routes.js";
import { fileRoutes } from "./routes/file.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { taskRoutes } from "./routes/task.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { commentRoutes } from "./routes/comment.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { activityRoutes } from "./routes/activity.routes.js";
import { roomTimelineRoutes } from "./routes/room-timeline.routes.js";
import { reportRoutes } from "./routes/report.routes.js";
import { portalRoutes } from "./routes/portal.routes.js";
import { agentPortalRoutes } from "./routes/agent-portal.routes.js";
import { driverQualificationRoutes } from "./routes/driver-qualification.routes.js";
import { documentRoutes } from "./routes/document.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { cvParseRoutes } from "./routes/cv-parse.routes.js";
import { geocodingRoutes } from "./routes/geocoding.routes.js";
import { onboardingRoutes } from "./routes/onboarding.routes.js";
import { billingRoutes } from "./routes/billing.routes.js";
import { campaignRoutes } from "./routes/campaign.routes.js";
import { targetingTemplateRoutes } from "./routes/targeting-template.routes.js";
import { personaTemplateRoutes } from "./routes/persona-template.routes.js";
import { metaRoutes } from "./routes/meta.routes.js";
import { aiScreeningRoutes } from "./routes/ai-screening.routes.js";
import { linkedinRoutes } from "./routes/linkedin.routes.js";
import { calendarRoutes } from "./routes/calendar.routes.js";
import { interviewRoutes } from "./routes/interview.routes.js";
import { placementRoutes } from "./routes/placement.routes.js";
import { gdprRoutes } from "./routes/gdpr.routes.js";
import type { AppEnv } from "./lib/app-env.js";
import { startJobQueue, getJobQueue } from "./lib/job-queue.js";
import { registerJobHandlers } from "./jobs/job-handlers.js";
import { initSocketIO } from "./lib/socket.js";
import { Sentry } from "./instrument.js";
import { publicLimiter } from "./middleware/rate-limit.middleware.js";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

const app = new Hono<AppEnv>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return process.env.FRONTEND_URL || "http://localhost:3002";
      const allowed =
        /^https:\/\/[\w-]+\.recruitment-os\.nl$/.test(origin) ||
        /^http:\/\/[\w-]+\.localhost:3002$/.test(origin) ||
        origin === (process.env.FRONTEND_URL || "http://localhost:3002");
      return allowed ? origin : null;
    },
    credentials: true,
  })
);

// Enhanced health check (no auth required) — REL-04
app.get("/health", async (c) => {
  const checks: Record<string, string> = {};

  // Probe database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Probe pg-boss job queue
  try {
    if (process.env.JOBS_ENABLED === "true") {
      const boss = getJobQueue();
      await boss.getQueues();
      checks.jobQueue = "ok";
    } else {
      checks.jobQueue = "disabled";
    }
  } catch {
    checks.jobQueue = "error";
  }

  const status =
    checks.database === "ok" &&
    (checks.jobQueue === "ok" || checks.jobQueue === "disabled")
      ? "ok"
      : "degraded";

  return c.json({ status, checks }, status === "ok" ? 200 : 503);
});

// Rate limiting on public and auth routes — REL-02
app.use("/api/public/*", publicLimiter);
app.use("/api/auth/*", publicLimiter);

// Better Auth handler — must be before auth middleware
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// Mount public routes BEFORE auth middleware so they bypass authentication
app.route("/api", publicRoutes);

// Auth + tenant middleware on all /api/* routes (excluding /api/auth/* and /api/public/*)
app.use("/api/*", async (c, next) => {
  // Skip auth middleware for Better Auth routes, public routes, and billing webhook
  if (c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/api/public/") || c.req.path === "/api/billing/webhook") {
    return next();
  }
  return authMiddleware(c, next);
});

app.use("/api/*", async (c, next) => {
  // Skip tenant middleware for Better Auth routes, public routes, and billing webhook
  if (c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/api/public/") || c.req.path === "/api/billing/webhook") {
    return next();
  }
  return tenantMiddleware(c, next);
});

// Mount domain routes
app.route("/api/vacancies", vacancyRoutes);
app.route("/api/candidates", candidateRoutes);
app.route("/api/applications", applicationRoutes);
app.route("/api/pipeline", pipelineRoutes);
app.route("/api/clients", clientRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/comments", commentRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/activity", activityRoutes);
app.route("/api/room-timeline", roomTimelineRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/portal", portalRoutes);
app.route("/api/agent", agentPortalRoutes);
app.route("/api/driver-qualifications", driverQualificationRoutes);
app.route("/api/documents", documentRoutes);
app.route("/api/cv-parse", cvParseRoutes);
app.route("/api/geo", geocodingRoutes);
app.route("/api/onboarding", onboardingRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/campaigns", campaignRoutes);
app.route("/api/targeting-templates", targetingTemplateRoutes);
app.route("/api/persona-templates", personaTemplateRoutes);
app.route("/api/meta", metaRoutes);
app.route("/api/ai-screening", aiScreeningRoutes);
app.route("/api/linkedin", linkedinRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/interviews", interviewRoutes);
app.route("/api/placements", placementRoutes);
app.route("/api/gdpr", gdprRoutes);

// Sentry error handler — captures unhandled errors
app.onError((err, c) => {
  Sentry.captureException(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Boot pg-boss job queue + register handlers before listening.
// Gated by JOBS_ENABLED env var so dev can opt out.
await startJobQueue();
await registerJobHandlers();

const httpServer = serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});

// Attach Socket.IO to the existing HTTP server (same port)
initSocketIO(httpServer);

export type AppType = typeof app;
