import "dotenv/config";

import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required by the Prisma CLI");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migration scripts assert that DIRECT_URL is set and non-pooled first. Falling
    // back here lets build-time `prisma generate` stay database-independent on hosts
    // that provide DATABASE_URL only; it does not weaken the migration guard.
    // The Prisma CLI (migrate/db) must use the direct, non-pooled endpoint.
    // Neon's `-pooler` host is PgBouncer in transaction mode, which cannot hold the
    // session-level advisory lock `migrate deploy` takes — it fails with P1002 and
    // leaks the lock into a pooled server connection. The app runtime keeps using
    // the pooled DATABASE_URL (see lib/prisma.ts).
    url: datasourceUrl,
  },
});
