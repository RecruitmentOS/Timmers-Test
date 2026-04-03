import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { auth } from "./auth.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { tenantMiddleware } from "./middleware/tenant.middleware.js";

type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    organizationId: string;
  };
};

const app = new Hono<AppEnv>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});

export type AppType = typeof app;
