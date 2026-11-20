import { nuvionClient } from "@umohpyro/better-auth-nuvion/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [organizationClient(), nuvionClient()],
});
