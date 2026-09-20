import "dotenv/config";

const value = process.env.DIRECT_URL?.trim();

if (!value) {
  throw new Error(
    "DIRECT_URL is required for migrations. Use the provider's direct, non-pooled PostgreSQL endpoint.",
  );
}

let url;
try {
  url = new URL(value);
} catch {
  throw new Error("DIRECT_URL must be a valid PostgreSQL URL.");
}

if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
  throw new Error("DIRECT_URL must use the postgresql:// or postgres:// protocol.");
}

if (
  /(?:^|[.-])(pooler|pgbouncer)(?:[.-]|$)/i.test(url.hostname) ||
  url.searchParams.get("pgbouncer") === "true"
) {
  throw new Error(
    "DIRECT_URL appears to be a pooled endpoint. Prisma migrations require the direct database host.",
  );
}
