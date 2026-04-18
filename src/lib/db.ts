import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getDbConfig } from "@/lib/db-config";

const globalForPg = globalThis as unknown as { pool?: Pool };

/**
 * Lazy pool: `getDbConfig()` runs on first query, not at module load.
 * Allows `next build` without DATABASE_URL / PG* (e.g. Railway build container).
 */
function getPool(): Pool {
  if (!globalForPg.pool) {
    globalForPg.pool = new Pool(getDbConfig());
  }
  return globalForPg.pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
