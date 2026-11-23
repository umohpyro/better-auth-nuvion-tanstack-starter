# better-auth-nuvion TanStack Start starter

The smallest useful [TanStack Start](https://tanstack.com/start) app on [`@umohpyro/better-auth-nuvion`](https://www.npmjs.com/package/@umohpyro/better-auth-nuvion): sign in, connect your Nuvion account, take a £1.00 payment through hosted checkout, and watch it settle. It is the same flow as the [Next.js starter](https://github.com/umohpyro/better-auth-nuvion-starter), with TanStack Start's server route and server function.

For splits across a platform, resellers and merchants, fee rules and refunds, see the [full example](https://github.com/umohpyro/better-auth-nuvion-example) and the [docs](https://docs.better-auth-nuvion.umoh.name.ng).

## What it shows

| File                            | What                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/plugins.ts`            | The three plugins: `organization()`, `apiKey()`, `nuvion({...})`                                                              |
| `src/lib/auth.ts`               | Better Auth with those plugins, and `tanstackStartCookies()` as the last one                                                  |
| `src/routes/api/auth/$.ts`      | A server route that mounts the Better Auth handler. The Nuvion webhook receiver is under it: `/api/auth/nuvion/webhook`       |
| `src/lib/checkout.functions.ts` | A server function that creates the payment with `auth.api.createPayment`, so the key and the plugin stay on the server        |
| `src/lib/auth-client.ts`        | `nuvionClient()` for typed client calls                                                                                       |
| `src/routes/index.tsx`          | Sign in, connect an entity and account (`nuvion.organization.bind`), pay (the server function), list (`nuvion.payments.list`) |
| `scripts/migrate.mts`           | Creates the tables with the app's own Better Auth                                                                             |

## Run it

You need a Nuvion account in the test environment with an approved entity and one account.

```bash
npm install
cp .env.example .env.local     # set BETTER_AUTH_SECRET, NUVION_API_KEY, NUVION_WEBHOOK_SECRET
npm run migrate                # creates ./dev.db (SQLite), or uses DATABASE_URL for Postgres
npm run dev
```

Using pnpm, yarn or bun? Swap `npm install` for `pnpm install`, `yarn` or `bun install`, and `npm run <script>` for `pnpm <script>`, `yarn <script>` or `bun run <script>`.

1. Create a webhook in Nuvion pointing at `https://<your-https-host>/api/auth/nuvion/webhook` (Nuvion only delivers to https, so use a deployed app or a tunnel) and put its signing secret in `NUVION_WEBHOOK_SECRET`. Or call `authClient.nuvion.registerWebhook({ organizationId })` once the organization is bound: it registers the webhook with every event the plugin needs and returns the secret once.
2. Open the app, sign up, enter a shop name and your entity and account ids, press **Connect**.
3. Press **Pay £1.00**, pay in the hosted checkout, come back. The payment goes `pending`, then `received` and `settled` as Nuvion's signed webhooks arrive.

With one organization there is nobody to split with, so the payment settles without legs. Add a parent organization (see the full example) to split it.

## Going live

Set `NUVION_BASE_URL=https://api.nuvion.co` with a production key and secret, and read [Going to production](https://docs.better-auth-nuvion.umoh.name.ng/docs/guides/production) first.

MIT licensed.
