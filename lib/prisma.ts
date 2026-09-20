import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import type { GlobalWithPrisma } from "@/types";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/store";

const prismaGlobal = globalThis as GlobalWithPrisma;

function createPrismaClient() {
  // Prisma 7 driver adapters hand pooling to `pg`, which defaults to
  // connectionTimeoutMillis: 0 (wait forever) and idleTimeoutMillis: 10s.
  // The Prisma 6 engine used connect_timeout=5s / max_idle_connection_lifetime=300s,
  // so these have to be set explicitly or a sleeping serverless database
  // (Neon auto-suspend) hangs the request instead of failing fast.
  const adapter = new PrismaPg(
    {
      connectionString,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      maxLifetimeSeconds: 300,
      keepAlive: true,
      max: 10,
    },
    {
      onPoolError: (error) => console.error("prisma:pool", error.message),
      onConnectionError: (error) =>
        console.error("prisma:connection", error.message),
    },
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = prismaGlobal.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}
