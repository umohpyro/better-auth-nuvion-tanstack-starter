import { Pool } from "pg";

// Postgres when DATABASE_URL is set, otherwise a local SQLite file (node:sqlite).
export const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  : new (await import("node:sqlite")).DatabaseSync(
      process.env.DB_PATH ?? "./dev.db",
    );
