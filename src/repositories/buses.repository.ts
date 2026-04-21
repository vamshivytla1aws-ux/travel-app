import { query, withTransaction } from "@/lib/db";
import { Bus } from "@/lib/types";

type BusRow = {
  id: number;
  bus_number: string;
  registration_number: string;
  make: string;
  model: string;
  seater: number;
  odometer_km: string;
  previous_day_mileage_kmpl: string | null;
  status: Bus["status"];
  last_service_at: string | null;
};

function mapBus(row: BusRow): Bus {
  return {
    id: row.id,
    busNumber: row.bus_number,
    registrationNumber: row.registration_number,
    make: row.make,
    model: row.model,
    seater: row.seater,
    odometerKm: Number(row.odometer_km),
    previousDayMileageKmpl:
      row.previous_day_mileage_kmpl !== null ? Number(row.previous_day_mileage_kmpl) : null,
    status: row.status,
    lastServiceAt: row.last_service_at,
  };
}

export class BusesRepository {
  async listPaged(
    search = "",
    status?: Bus["status"],
    page = 1,
    limit = 20,
  ): Promise<{ items: Bus[]; total: number }> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const params: unknown[] = [];
    const where: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(bus_number ILIKE $${params.length} OR registration_number ILIKE $${params.length})`,
      );
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM buses ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? "0");

    params.push(safeLimit, offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;
    const sql = `
      SELECT
        b.id,
        b.bus_number,
        b.registration_number,
        b.make,
        b.model,
        b.seater,
        b.odometer_km,
        pd.previous_day_mileage_kmpl,
        b.status,
        b.last_service_at
      FROM buses b
      LEFT JOIN (
        SELECT
          bus_id,
          (
            SUM(odometer_after_km - odometer_before_km) /
            NULLIF(SUM(liters), 0)
          )::text AS previous_day_mileage_kmpl
        FROM fuel_entries
        WHERE DATE(filled_at) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY bus_id
      ) pd ON pd.bus_id = b.id
      ${whereSql}
      ORDER BY b.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;
    const result = await query<BusRow>(sql, params);
    return { items: result.rows.map(mapBus), total };
  }

  async list(search = "", status?: Bus["status"]): Promise<Bus[]> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(bus_number ILIKE $${params.length} OR registration_number ILIKE $${params.length})`,
      );
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `
      SELECT
        b.id,
        b.bus_number,
        b.registration_number,
        b.make,
        b.model,
        b.seater,
        b.odometer_km,
        pd.previous_day_mileage_kmpl,
        b.status,
        b.last_service_at
      FROM buses b
      LEFT JOIN (
        SELECT
          bus_id,
          (
            SUM(odometer_after_km - odometer_before_km) /
            NULLIF(SUM(liters), 0)
          )::text AS previous_day_mileage_kmpl
        FROM fuel_entries
        WHERE DATE(filled_at) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY bus_id
      ) pd ON pd.bus_id = b.id
      ${whereSql}
      ORDER BY b.id DESC
    `;
    const result = await query<BusRow>(sql, params);
    return result.rows.map(mapBus);
  }

  async getById(id: number): Promise<Bus | null> {
    const result = await query<BusRow>(
      `SELECT b.id, b.bus_number, b.registration_number, b.make, b.model, b.seater, b.odometer_km,
              pd.previous_day_mileage_kmpl, b.status, b.last_service_at
       FROM buses b
       LEFT JOIN (
         SELECT
           bus_id,
           (
             SUM(odometer_after_km - odometer_before_km) /
             NULLIF(SUM(liters), 0)
           )::text AS previous_day_mileage_kmpl
         FROM fuel_entries
         WHERE DATE(filled_at) = CURRENT_DATE - INTERVAL '1 day'
         GROUP BY bus_id
       ) pd ON pd.bus_id = b.id
       WHERE b.id = $1`,
      [id],
    );
    return result.rows[0] ? mapBus(result.rows[0]) : null;
  }

  async create(input: {
    busNumber: string;
    registrationNumber: string;
    make: string;
    model: string;
    seater: number;
    odometerKm: number;
    status?: Bus["status"];
  }): Promise<Bus> {
    const result = await query<BusRow>(
      `INSERT INTO buses (bus_number, registration_number, make, model, seater, odometer_km, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, bus_number, registration_number, make, model, seater, odometer_km, NULL::text AS previous_day_mileage_kmpl, status, last_service_at`,
      [
        input.busNumber,
        input.registrationNumber,
        input.make,
        input.model,
        input.seater,
        input.odometerKm,
        input.status ?? "active",
      ],
    );
    return mapBus(result.rows[0]);
  }

  async update(
    id: number,
    input: {
      busNumber: string;
      registrationNumber: string;
      make: string;
      model: string;
      seater: number;
      odometerKm: number;
      status: Bus["status"];
    },
  ): Promise<Bus | null> {
    const result = await query<BusRow>(
      `UPDATE buses
       SET bus_number = $1,
           registration_number = $2,
           make = $3,
           model = $4,
           seater = $5,
           odometer_km = $6,
           status = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, bus_number, registration_number, make, model, seater, odometer_km, NULL::text AS previous_day_mileage_kmpl, status, last_service_at`,
      [
        input.busNumber,
        input.registrationNumber,
        input.make,
        input.model,
        input.seater,
        input.odometerKm,
        input.status,
        id,
      ],
    );
    return result.rows[0] ? mapBus(result.rows[0]) : null;
  }

  async hardDelete(id: number): Promise<boolean> {
    return withTransaction(async (client) => {
      const existing = await client.query<{ id: number }>(
        `SELECT id FROM buses WHERE id = $1 LIMIT 1`,
        [id],
      );
      if ((existing.rowCount ?? 0) === 0) return false;

      const candidateTables = [
        "fuel_issues",
        "trip_runs",
        "gps_logs",
        "fuel_entries",
        "maintenance_records",
        "route_planner_entries",
        "bus_documents",
        "bus_assignments",
      ] as const;

      const existingTablesResult = await client.query<{ tablename: string }>(
        `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename = ANY($1::text[])
        `,
        [candidateTables],
      );
      const existingTables = new Set(existingTablesResult.rows.map((row) => row.tablename));

      if (existingTables.has("fuel_issues")) {
        await client.query(`DELETE FROM fuel_issues WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("trip_runs")) {
        await client.query(`DELETE FROM trip_runs WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("gps_logs")) {
        await client.query(`DELETE FROM gps_logs WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("fuel_entries")) {
        await client.query(`DELETE FROM fuel_entries WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("maintenance_records")) {
        await client.query(`DELETE FROM maintenance_records WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("route_planner_entries")) {
        await client.query(`DELETE FROM route_planner_entries WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("bus_documents")) {
        await client.query(`DELETE FROM bus_documents WHERE bus_id = $1`, [id]);
      }
      if (existingTables.has("bus_assignments")) {
        await client.query(`DELETE FROM bus_assignments WHERE bus_id = $1`, [id]);
      }

      const deleted = await client.query(`DELETE FROM buses WHERE id = $1`, [id]);
      return (deleted.rowCount ?? 0) > 0;
    });
  }
}
