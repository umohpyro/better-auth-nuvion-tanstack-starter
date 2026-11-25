import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../../lib/auth";
import { withVisitorKey } from "../../../lib/byo";

// One Better Auth handler. The Nuvion webhook receiver is under it: /api/auth/nuvion/webhook.
// withVisitorKey only does something when visitors bring their own key (src/lib/byo.ts).
const handle = ({ request }: { request: Request }) =>
  withVisitorKey(request.headers, () => auth.handler(request));
export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
