import { createFileRoute } from "@tanstack/react-router";
import { byo, checkKey, COOKIE, cookieOf, open, seal } from "../../lib/byo";

// The visitor's own Nuvion key, kept in a sealed cookie in their browser (see src/lib/byo.ts). It is never sent back to the page.
const sameOrigin = (req: Request) =>
  req.headers.get("origin") === new URL(req.url).origin;
const setCookie = (req: Request, value: string, maxAge: number) =>
  `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${req.url.startsWith("https:") ? "; Secure" : ""}`;

export const Route = createFileRoute("/api/key")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const token = cookieOf(request.headers);
        return Response.json({
          byo,
          connected: byo && !!token && (await open(token)) !== null,
        });
      },
      POST: async ({ request }: { request: Request }) => {
        if (!byo || !sameOrigin(request))
          return Response.json({ error: "Not allowed." }, { status: 403 });
        const body = (await request.json().catch(() => null)) as {
          apiKey?: unknown;
        } | null;
        const key = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        const problem = await checkKey(key);
        if (problem) return Response.json({ error: problem }, { status: 400 });
        return Response.json(
          { connected: true },
          // Eight hours, as long as a demo session needs.
          {
            headers: {
              "Set-Cookie": setCookie(request, await seal(key), 8 * 3600),
            },
          },
        );
      },
      DELETE: ({ request }: { request: Request }) => {
        if (!sameOrigin(request))
          return Response.json({ error: "Not allowed." }, { status: 403 });
        return Response.json(
          { connected: false },
          { headers: { "Set-Cookie": setCookie(request, "", 0) } },
        );
      },
    },
  },
});
