import { query } from "@/lib/db";
import { FuelEntry } from "@/lib/types";

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
}
