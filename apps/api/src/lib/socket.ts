/**
 * Phase 3 — Socket.IO server for realtime pipeline updates + presence.
 *
 * Attaches to the existing Hono HTTP server (same port).
 * Auth middleware validates Better Auth session cookie.
 * Domain events subscriber broadcasts pipeline mutations to tenant rooms.
 */

import type { Server as HttpServer } from "node:http";
import type { ServerType } from "@hono/node-server";
import { Server, type Socket } from "socket.io";
import { auth } from "../auth.js";
import { domainEvents } from "./domain-events.js";

let io: Server | null = null;

/** Socket.data shape after auth middleware */
interface SocketData {
  orgId: string;
  userId: string;
  userName: string;
}

/**
 * Initialize Socket.IO on the existing HTTP server.
 * Must be called AFTER `serve()` returns the httpServer.
 */
export function initSocketIO(httpServer: ServerType): Server {
  io = new Server(httpServer as HttpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3002",
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  // ── Auth middleware ────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next(new Error("Unauthorized"));

      // Parse better-auth.session_token from cookie header
      const sessionToken = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("better-auth.session_token="))
        ?.split("=")
        .slice(1)
        .join("=");

      if (!sessionToken) return next(new Error("Unauthorized"));

      // Validate session via Better Auth API
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });

      if (!session?.user) return next(new Error("Unauthorized"));

      // Populate socket.data for room scoping
      socket.data.orgId =
        (session.session as Record<string, unknown>).activeOrganizationId as string;
      socket.data.userId = session.user.id;
      socket.data.userName = session.user.name || session.user.email;

      if (!socket.data.orgId) return next(new Error("Unauthorized"));

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const { orgId, userId, userName } = socket.data as SocketData;

    // Auto-join tenant + user rooms
    socket.join(`tenant:${orgId}`);
    socket.join(`user:${userId}`);

    // Vacancy presence: join
    socket.on("join:vacancy", (vacancyId: string) => {
      socket.join(`vacancy:${vacancyId}`);
      socket.to(`vacancy:${vacancyId}`).emit("presence:join", {
        userId,
        userName,
      });
    });

    // Vacancy presence: leave
    socket.on("leave:vacancy", (vacancyId: string) => {
      socket.leave(`vacancy:${vacancyId}`);
      socket.to(`vacancy:${vacancyId}`).emit("presence:leave", {
        userId,
        userName,
      });
    });

    // On disconnecting: broadcast presence:leave for all vacancy rooms
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("vacancy:")) {
          socket.to(room).emit("presence:leave", { userId, userName });
        }
      }
    });
  });

  // ── Domain events subscriber (pipeline events only — D-01) ────────
  const pipelineEvents = new Set([
    "application.stage_changed",
    "application.qualified",
    "application.bulk_move",
    "application.bulk_reject",
    "application.bulk_assign",
  ]);

  domainEvents.subscribe((event) => {
    if (!pipelineEvents.has(event.type)) return;
    io!.to(`tenant:${event.orgId}`).emit("pipeline:update", {
      ...event,
    });
  });

  return io;
}

/** Get the Socket.IO server instance (used by notification service later). */
export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized — call initSocketIO first");
  return io;
}
