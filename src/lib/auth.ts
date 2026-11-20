import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "./db";
import { plugins } from "./plugins";

export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true },
  plugins: [
    ...plugins({
      apiKey: process.env.NUVION_API_KEY!,
      webhookSecret: process.env.NUVION_WEBHOOK_SECRET!,
    }),
    // Lets calls to auth.api inside server functions set cookies. Keep it the last plugin.
    tanstackStartCookies(),
  ],
});
