import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../../lib/auth";

// One Better Auth handler. The Nuvion webhook receiver is under it: /api/auth/nuvion/webhook.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
});
