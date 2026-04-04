import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  plugins: [organizationClient(), magicLinkClient()],
});

export { authClient };

export const { signIn, signUp, signOut, useSession, organization } = authClient;
