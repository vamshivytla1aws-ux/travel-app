import dotenv from "dotenv";
import { Pool } from "pg";
import { getDbConfig } from "../src/lib/db-config";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const pool = new Pool(getDbConfig());

const DATA_TABLES = [
  "employee_assignments",
  "gps_logs",
  "fuel_entries",
  "maintenance_records",
  "trip_runs",
  "route_planner_entries",
  "bus_assignments",
  "route_stops",
  "routes",
  "fuel_issues",
  "fuel_truck_ledger",
  "fuel_truck_refills",
  "fuel_trucks",
  "bus_documents",
  "driver_documents",
  "employees",
  "drivers",
  "buses",
  "audit_logs",
] as const;

function q(name: string) {
  return `"${name.replace(/"/g, "\"\"")}"`;
}

async function run() {
  const client = await pool.connect();
  try {
    const existing = await client.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [DATA_TABLES],
    );

    const existingSet = new Set(existing.rows.map((row) => row.table_name));
    const ordered = DATA_TABLES.filter((name) => existingSet.has(name));

    if (ordered.length === 0) {
      console.log("No sample data tables found. Nothing to clear.");
      return;
    }

    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${ordered.map(q).join(", ")} RESTART IDENTITY CASCADE`);
    await client.query("COMMIT");

    console.log("Sample data cleared successfully.");
    console.log("Kept users table intact so existing logins continue to work.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to clear sample data:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
