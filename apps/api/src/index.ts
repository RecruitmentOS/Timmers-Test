import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});
