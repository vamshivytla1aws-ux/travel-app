/**
 * Apply pending SQL files from db/migrations/ in sorted order (e.g. 001_*.sql, 002_*.sql).
 * Records applied files in schema_migrations so each file runs once.
 *
 * Usage (local):  npm run db:migrate
 * Railway:        railway run npm run db:migrate   OR set DATABASE_URL and run from CI
 *
 * Requires: DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE (see .env.example)
 */
import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { getDbConfig } from "../src/lib/db-config";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(projectRoot, "db", "migrations");

async function main() {
  const pool = new Pool(getDbConfig());

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  let files: string[];
  try {
    files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => {
        const aIsCanonicalSchema = a === "schema.sql";
        const bIsCanonicalSchema = b === "schema.sql";
        if (aIsCanonicalSchema && !bIsCanonicalSchema) return -1;
        if (bIsCanonicalSchema && !aIsCanonicalSchema) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      });
  } catch (e) {
    console.error(`Cannot read ${migrationsDir}. Create db/migrations and add .sql files.`, e);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  if (files.length === 0) {
    console.log("No .sql files in db/migrations — nothing to apply.");
    await pool.end();
    return;
  }

  for (const file of files) {
    const { rowCount } = await pool.query<{ n: number }>(
      `SELECT 1 AS n FROM schema_migrations WHERE version = $1`,
      [file],
    );
    if ((rowCount ?? 0) > 0) {
      console.log(`[skip] ${file}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = await readFile(fullPath, "utf-8");
    const trimmed = sql.trim();
    if (!trimmed) {
      console.log(`[skip empty] ${file}`);
      await pool.query(`INSERT INTO schema_migrations(version) VALUES ($1)`, [file]);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(trimmed);
      await client.query(`INSERT INTO schema_migrations(version) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      console.log(`[applied] ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[failed] ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log("Migrations finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
