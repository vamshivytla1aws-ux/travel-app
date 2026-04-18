import { describe, expect, it } from "vitest";
import { getDbConfig } from "@/lib/db-config";

function withEnv<T>(env: NodeJS.ProcessEnv, fn: () => T): T {
  const original = { ...process.env };
  process.env = { ...original, ...env };
  try {
    return fn();
  } finally {
    process.env = original;
  }
}

describe("getDbConfig", () => {
  it("prefers DATABASE_URL when set (Railway-style: URL carries the password)", () =>
    withEnv(
      {
        PGHOST: "localhost",
        PGPORT: "5432",
        PGDATABASE: "employee_transport",
        PGUSER: "postgres",
        PGPASSWORD: "from-pg-star",
        DATABASE_URL: "postgresql://postgres:from-url@localhost:5432/employee_transport",
      },
      () => {
        const config = getDbConfig();
        expect(config).toMatchObject({
          connectionString:
            "postgresql://postgres:from-url@localhost:5432/employee_transport",
        });
      },
    ));

  it("falls back to PG* when DATABASE_URL is unset", () =>
    withEnv(
      {
        DATABASE_URL: "",
        PGHOST: "localhost",
        PGPORT: "5432",
        PGDATABASE: "employee_transport",
        PGUSER: "postgres",
        PGPASSWORD: "secret",
      },
      () => {
        const config = getDbConfig();
        expect(config).toMatchObject({
          host: "localhost",
          user: "postgres",
          password: "secret",
          database: "employee_transport",
          port: 5432,
        });
      },
    ));

  it("throws if only discrete PG* is set without a password", () =>
    withEnv(
      {
        DATABASE_URL: "",
        PGHOST: "localhost",
        PGUSER: "postgres",
        PGDATABASE: "employee_transport",
      },
      () => {
        expect(() => getDbConfig()).toThrow(/password missing/i);
      },
    ));
});
