export const RESOURCES = {
  vacancy: ["create", "read", "update", "delete"],
  candidate: ["create", "read", "update", "delete"],
  application: ["create", "read", "update", "delete", "move"],
  client: ["create", "read", "update", "delete"],
  task: ["create", "read", "update", "delete"],
  tag: ["create", "read", "delete"],
  dashboard: ["read"],
  bulk: ["execute"],
  report: ["read"],
  settings: ["read", "update"],
  user: ["create", "read", "update", "delete", "invite"],
  comment: ["create", "read", "update", "delete"],
  notification: ["read", "update"],
  activity: ["read"],
  campaign: ["create", "read", "update", "delete"],
  calendar: ["create", "read", "delete"],
  interview: ["create", "read", "update", "delete"],
} as const;

export type Resource = keyof typeof RESOURCES;
export type Action<R extends Resource> = (typeof RESOURCES)[R][number];
