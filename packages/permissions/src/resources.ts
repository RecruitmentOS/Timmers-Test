export const RESOURCES = {
  vacancy: ["create", "read", "update", "delete"],
  candidate: ["create", "read", "update", "delete"],
  application: ["create", "read", "update", "delete", "move"],
  client: ["create", "read", "update", "delete"],
  task: ["create", "read", "update", "delete"],
  report: ["read"],
  settings: ["read", "update"],
  user: ["create", "read", "update", "delete", "invite"],
} as const;

export type Resource = keyof typeof RESOURCES;
export type Action<R extends Resource> = (typeof RESOURCES)[R][number];
