import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

function clientFingerprint(headerStore: Headers) {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headerStore.get("x-real-ip") || "unknown";
  const salt = process.env.BETTER_AUTH_SECRET ?? "development-rate-limit-salt";
  return createHash("sha256").update(`${salt}|${address}`).digest("hex");
}

/**
 * Database-backed fixed-window limiter shared across server instances. The raw
 * address is never persisted; application counters are namespaced away from
 * Better Auth counters that use the same table.
 */
export async function consumeRateLimit(
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1_000;
  const fingerprint = clientFingerprint(await headers());
  const key = `app:${scope}:${fingerprint}`;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."lastRequest" < ${BigInt(windowStart)} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "lastRequest" = CASE
        WHEN "RateLimit"."lastRequest" < ${BigInt(windowStart)} THEN ${BigInt(now)}
        ELSE "RateLimit"."lastRequest"
      END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}
