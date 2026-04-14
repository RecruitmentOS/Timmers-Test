import { rateLimiter } from "hono-rate-limiter";
import type { AppEnv } from "../lib/app-env.js";

/**
 * Rate limiter for public routes (/api/public/*, /api/auth/*).
 * 100 requests per minute per IP address.
 * Uses x-forwarded-for (first IP in chain) for proxy-safe client identification.
 */
export const publicLimiter = rateLimiter<AppEnv>({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-7",
  keyGenerator: (c) => {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return c.req.header("cf-connecting-ip") ?? "unknown";
  },
});
