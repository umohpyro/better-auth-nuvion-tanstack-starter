import { apiKey } from "@better-auth/api-key";
import { nuvion } from "@umohpyro/better-auth-nuvion";
import { organization } from "better-auth/plugins";

// One list for the app and the migration script, so the tables always match.
export const plugins = (secrets: { apiKey: string; webhookSecret: string }) => [
  organization(),
  apiKey(),
  nuvion({ ...secrets, baseUrl: process.env.NUVION_BASE_URL }),
];
