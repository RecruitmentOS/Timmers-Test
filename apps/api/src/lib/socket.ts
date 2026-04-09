/**
 * Socket.IO integration stub.
 *
 * 03-03 (Socket.IO plan) provides the real implementation. This stub
 * ensures 03-04 code compiles even when 03-03 hasn't merged yet.
 * Once 03-03 merges, this file is replaced by the real socket.ts
 * with full Socket.IO server and room management.
 */

type SocketIOServer = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
  sockets: { adapter: { rooms: Map<string, Set<string>> } };
};

let io: SocketIOServer | null = null;

export function setIO(server: SocketIOServer): void {
  io = server;
}

/**
 * Returns the Socket.IO server instance.
 * If not initialized (03-03 not yet merged), returns a no-op proxy
 * so callers never crash.
 */
export function getIO(): SocketIOServer {
  if (io) return io;

  // No-op fallback — emits silently do nothing
  return {
    to: () => ({ emit: () => {} }),
    sockets: { adapter: { rooms: new Map() } },
  };
}
