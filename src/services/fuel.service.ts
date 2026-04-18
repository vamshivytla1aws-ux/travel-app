import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

type CreateFuelInput = {
  busId: number;
  driverId: number | null;
  odometerBeforeKm: number;
  odometerAfterKm: number;
  liters: number;
  amount?: number;
  companyName?: string;
  fuelStation?: string;
};

export class FuelService {
  async addFuelEntry(input: CreateFuelInput) {
    await ensureTransportEnhancements();
    if (input.odometerAfterKm < input.odometerBeforeKm) {
      throw new Error("odometerAfterKm must be greater than or equal to odometerBeforeKm");
    }

    const mileageKm = Number((input.odometerAfterKm - input.odometerBeforeKm).toFixed(2));
    const efficiencyKmPerLiter = Number((mileageKm / input.liters).toFixed(2));

    await query(
      `INSERT INTO fuel_entries
       (bus_id, driver_id, filled_at, odometer_before_km, odometer_after_km, liters, amount, fuel_station, company_name)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)`,
      [
        input.busId,
        input.driverId,
        input.odometerBeforeKm,
        input.odometerAfterKm,
        input.liters,
        input.amount ?? 0,
        input.fuelStation ?? null,
        input.companyName ?? null,
      ],
    );

    await query(`UPDATE buses SET odometer_km = $1, updated_at = NOW() WHERE id = $2`, [
      input.odometerAfterKm,
      input.busId,
    ]);

    return { mileageKm, efficiencyKmPerLiter };
  }
}
