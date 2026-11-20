// Creates or updates the tables (SQLite by default, Postgres with DATABASE_URL). Uses the app's own better-auth version.
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import { plugins } from "../src/lib/plugins";

const database = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  : new DatabaseSync(process.env.DB_PATH ?? "./dev.db");
const auth = betterAuth({
  database,
  baseURL: "http://localhost:3000",
  secret: "migration-only-secret-not-used-for-anything-0123456789",
  emailAndPassword: { enabled: true },
  plugins: plugins({
    apiKey: "migration-only",
    webhookSecret: "migration-only",
  }),
});
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
  auth.options,
);
if (!toBeCreated.length && !toBeAdded.length)
  console.log("Nothing to migrate.");
else {
  await runMigrations();
  console.log(
    `Migrated: ${toBeCreated.length} tables created, ${toBeAdded.length} changed.`,
  );
}
process.exit(0);
