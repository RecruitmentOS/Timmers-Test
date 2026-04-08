import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { magicLink } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index.js";

// Define permission statements matching the resources
// MUST stay in lockstep with packages/permissions/src/resources.ts
const statements = {
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
} as const;

const ac = createAccessControl(statements);

// Define 7 custom roles
const superAdmin = ac.newRole({
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
});

const agencyAdmin = ac.newRole({
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
});

const recruiter = ac.newRole({
  vacancy: ["create", "read", "update"],
  candidate: ["create", "read", "update"],
  application: ["create", "read", "update", "move"],
  client: ["read"],
  task: ["create", "read", "update"],
  tag: ["create", "read", "delete"],
  dashboard: ["read"],
  bulk: ["execute"],
  report: ["read"],
});

const agent = ac.newRole({
  vacancy: ["read"],
  candidate: ["create", "read", "update"],
  application: ["create", "read", "update", "move"],
  task: ["create", "read", "update"],
  tag: ["read"],
  dashboard: ["read"],
});

const hiringManager = ac.newRole({
  vacancy: ["read"],
  candidate: ["read"],
  application: ["read"],
  dashboard: ["read"],
  report: ["read"],
});

const clientViewer = ac.newRole({
  vacancy: ["read"],
  application: ["read"],
});

const marketingOp = ac.newRole({
  vacancy: ["read"],
  dashboard: ["read"],
  report: ["read"],
});

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3002"],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      ac,
      roles: {
        super_admin: superAdmin,
        agency_admin: agencyAdmin,
        recruiter,
        agent,
        hiring_manager: hiringManager,
        client_viewer: clientViewer,
        marketing_op: marketingOp,
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // In production, send via Resend/SMTP
        // For development, log the magic link URL to console
        console.log(`[Magic Link] Send to ${email}: ${url}`);
      },
      expiresIn: 600, // 10 minutes
    }),
  ],
});

export type Auth = typeof auth;
