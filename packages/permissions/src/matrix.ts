import type { AppRole } from "./roles.js";
import type { Resource } from "./resources.js";

type PermissionMatrix = Record<AppRole, Partial<Record<Resource, readonly string[]>>>;

export const PERMISSION_MATRIX: PermissionMatrix = {
  super_admin: {
    vacancy: ["create", "read", "update", "delete"],
    candidate: ["create", "read", "update", "delete"],
    application: ["create", "read", "update", "delete", "move"],
    client: ["create", "read", "update", "delete"],
    task: ["create", "read", "update", "delete"],
    report: ["read"],
    settings: ["read", "update"],
    user: ["create", "read", "update", "delete", "invite"],
  },
  agency_admin: {
    vacancy: ["create", "read", "update", "delete"],
    candidate: ["create", "read", "update", "delete"],
    application: ["create", "read", "update", "delete", "move"],
    client: ["create", "read", "update", "delete"],
    task: ["create", "read", "update", "delete"],
    report: ["read"],
    settings: ["read", "update"],
    user: ["create", "read", "update", "delete", "invite"],
  },
  recruiter: {
    vacancy: ["create", "read", "update"],
    candidate: ["create", "read", "update"],
    application: ["create", "read", "update", "move"],
    client: ["read"],
    task: ["create", "read", "update"],
    report: ["read"],
  },
  agent: {
    vacancy: ["read"],
    candidate: ["create", "read", "update"],
    application: ["create", "read", "update", "move"],
    task: ["create", "read", "update"],
  },
  hiring_manager: {
    vacancy: ["read"],
    candidate: ["read"],
    application: ["read"],
    report: ["read"],
  },
  client_viewer: {
    vacancy: ["read"],
    application: ["read"],
  },
  marketing_op: {
    vacancy: ["read"],
    report: ["read"],
  },
};

export function canPerform(role: AppRole, resource: Resource, action: string): boolean {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return false;
  const actions = rolePerms[resource];
  if (!actions) return false;
  return (actions as readonly string[]).includes(action);
}
