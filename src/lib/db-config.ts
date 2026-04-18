import type { PoolConfig } from "pg";

function asString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const poolOptions = {
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
} as const;

/**
 * Build Pool config for `pg`.
 *
 * Prefer `DATABASE_URL` when set (e.g. Railway) so credentials stay in one place.
 * If we used discrete PG* with `password: ""` when PGPASSWORD was unset, `pg`'s
 * ConnectionParameters treats a falsy password as missing and falls back to `null`,
 * which breaks SCRAM with: "client password must be a string".
 */
export function getDbConfig(): PoolConfig {
  const databaseUrl = asString(process.env.DATABASE_URL);
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ...poolOptions,
    };
  }

  const host = asString(process.env.PGHOST);
  const user = asString(process.env.PGUSER);
  const password = asString(process.env.PGPASSWORD);
  const database = asString(process.env.PGDATABASE);
  const port = Number(process.env.PGPORT ?? "5432");

  if (host && user && database) {
    if (!password) {
      throw new Error(
        "Database password missing. Set DATABASE_URL, or set PGPASSWORD alongside PGHOST/PGUSER/PGDATABASE.",
      );
    }
    return {
      host,
      user,
      password,
      database,
      port,
      ...poolOptions,
    };
  }

  throw new Error(
    "Database config missing. Set DATABASE_URL, or PGHOST/PGUSER/PGPASSWORD/PGDATABASE.",
  );
}
