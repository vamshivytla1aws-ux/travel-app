import { query } from "@/lib/db";
import { BusFuelHistoryItem, FuelEntry } from "@/lib/types";

type FuelEntryRow = {
  id: number;
  bus_id: number;
  driver_id: number | null;
  filled_at: string;
  odometer_before_km: string;
  odometer_after_km: string;
  liters: string;
  amount: string;
  fuel_station: string | null;
  company_name: string | null;
};

function mapFuelEntry(row: FuelEntryRow): FuelEntry {
  return {
    id: row.id,
    busId: row.bus_id,
    driverId: row.driver_id,
    filledAt: row.filled_at,
    odometerBeforeKm: Number(row.odometer_before_km),
    odometerAfterKm: Number(row.odometer_after_km),
    liters: Number(row.liters),
    amount: Number(row.amount),
    fuelStation: row.fuel_station,
    companyName: row.company_name,
  };
}

export class FuelRepository {
  async latestByBus(busId: number): Promise<FuelEntry | null> {
    const result = await query<FuelEntryRow>(
      `SELECT id, bus_id, driver_id, filled_at, odometer_before_km, odometer_after_km, liters, amount, fuel_station, company_name
       FROM fuel_entries
       WHERE bus_id = $1
       ORDER BY filled_at DESC
       LIMIT 1`,
      [busId],
    );
    return result.rows[0] ? mapFuelEntry(result.rows[0]) : null;
  }

  async listHistoryByBus(busId: number, limit = 20): Promise<FuelEntry[]> {
    const result = await query<FuelEntryRow>(
      `SELECT id, bus_id, driver_id, filled_at, odometer_before_km, odometer_after_km, liters, amount, fuel_station, company_name
       FROM fuel_entries
       WHERE bus_id = $1
       ORDER BY filled_at DESC
       LIMIT $2`,
      [busId, limit],
    );
    return result.rows.map(mapFuelEntry);
  }

  async listUnifiedHistoryByBus(busId: number, limit = 30): Promise<BusFuelHistoryItem[]> {
    const result = await query<{
      source: "TANKER" | "MANUAL";
      id: number;
      reference_id: number;
      fuel_truck_id: number | null;
      bus_id: number;
      filled_at: string;
      issue_date: string | null;
      issue_time: string | null;
      odometer_before_km: string | null;
      odometer_after_km: string | null;
      liters: string;
      amount: string;
      company_name: string | null;
      fuel_station: string | null;
    }>(
      `
      SELECT *
      FROM (
        SELECT
          'MANUAL'::text AS source,
          fe.id,
          fe.id AS reference_id,
          NULL::bigint AS fuel_truck_id,
          fe.bus_id,
          fe.filled_at::text,
          NULL::text AS issue_date,
          NULL::text AS issue_time,
          fe.odometer_before_km::text,
          fe.odometer_after_km::text,
          fe.liters::text,
          fe.amount::text,
          fe.company_name,
          fe.fuel_station
        FROM fuel_entries fe
        WHERE fe.bus_id = $1

        UNION ALL

        SELECT
          'TANKER'::text AS source,
          fi.id,
          fi.id AS reference_id,
          fi.fuel_truck_id,
          fi.bus_id,
          (fi.issue_date::text || 'T' || fi.issue_time::text)::text AS filled_at,
          fi.issue_date::text,
          fi.issue_time::text,
          fi.odometer_before_km::text,
          fi.odometer_after_km::text,
          fi.liters_issued::text AS liters,
          fi.amount::text,
          fi.company_name,
          NULL::text AS fuel_station
        FROM fuel_issues fi
        WHERE fi.bus_id = $1
      ) merged
      ORDER BY filled_at DESC, id DESC
      LIMIT $2
      `,
      [busId, limit],
    );

    return result.rows.map((row) => ({
      source: row.source,
      id: row.id,
      referenceId: row.reference_id,
      fuelTruckId: row.fuel_truck_id,
      busId: row.bus_id,
      filledAt: row.filled_at,
      issueDate: row.issue_date,
      issueTime: row.issue_time,
      odometerBeforeKm: row.odometer_before_km != null ? Number(row.odometer_before_km) : null,
      odometerAfterKm: row.odometer_after_km != null ? Number(row.odometer_after_km) : null,
      liters: Number(row.liters),
      amount: Number(row.amount),
      companyName: row.company_name,
      fuelStation: row.fuel_station,
    }));
  }
}
