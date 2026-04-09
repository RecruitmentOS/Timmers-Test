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
import type { AppEnv } from "./lib/app-env.js";
import { startJobQueue } from "./lib/job-queue.js";
import { registerJobHandlers } from "./jobs/job-handlers.js";
import { initSocketIO } from "./lib/socket.js";

const app = new Hono<AppEnv>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3002",
    credentials: true,
  })
);

// Health check (no auth required)
app.get("/health", (c) => c.json({ status: "ok" }));

// Better Auth handler — must be before auth middleware
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// Auth + tenant middleware on all /api/* routes (excluding /api/auth/*)
app.use("/api/*", async (c, next) => {
  // Skip auth middleware for Better Auth routes
  if (c.req.path.startsWith("/api/auth/")) {
    return next();
  }
  return authMiddleware(c, next);
});

app.use("/api/*", async (c, next) => {
  // Skip tenant middleware for Better Auth routes
  if (c.req.path.startsWith("/api/auth/")) {
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
