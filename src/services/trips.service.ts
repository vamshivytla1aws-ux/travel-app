import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

export type TripStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type AdhocTripRow = {
  id: number;
  trip_date: string;
  bus_id: number;
  driver_id: number;
  bus_number: string;
  driver_name: string;
  from_location: string;
  to_location: string;
  trip_days: number;
  remarks: string | null;
};

export class TripsService {
  async listTodayTrips() {
    await ensureTransportEnhancements();
    const result = await query<{
      id: number;
      trip_date: string;
      bus_id: number;
      driver_id: number;
      route_id: number;
      shift_label: string;
      company_name: string | null;
      status: TripStatus;
      bus_number: string;
      driver_name: string;
      route_name: string;
      started_at: string | null;
      completed_at: string | null;
      odometer_start_km: string | null;
      odometer_end_km: string | null;
      km_run: string | null;
      liters_filled: string | null;
      mileage_kmpl: string | null;
      remarks: string | null;
    }>(
      `SELECT
        tr.id,
        tr.trip_date::text,
        tr.bus_id,
        tr.driver_id,
        tr.route_id,
        tr.shift_label,
        tr.company_name,
        tr.status::text as status,
        b.bus_number,
        d.full_name as driver_name,
        r.route_name,
        tr.started_at::text,
        tr.completed_at::text,
        tr.odometer_start_km::text,
        tr.odometer_end_km::text,
        tr.km_run::text,
        tr.liters_filled::text,
        tr.mileage_kmpl::text,
        tr.remarks
      FROM trip_runs tr
      JOIN buses b ON b.id = tr.bus_id
      JOIN drivers d ON d.id = tr.driver_id
      JOIN routes r ON r.id = tr.route_id
      WHERE tr.trip_date = CURRENT_DATE
      ORDER BY tr.shift_label, tr.id DESC`,
    );
    return result.rows;
  }

  async createTrip(input: {
    busId: number;
    driverId: number;
    routeId: number;
    shiftLabel: string;
    companyName?: string;
    remarks?: string;
  }) {
    await ensureTransportEnhancements();
    await query(
      `INSERT INTO trip_runs (trip_date, shift_label, bus_id, driver_id, route_id, company_name, status, remarks)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, 'planned', $6)
       ON CONFLICT (bus_id, trip_date, shift_label) DO UPDATE SET
         driver_id = EXCLUDED.driver_id,
         route_id = EXCLUDED.route_id,
         company_name = EXCLUDED.company_name,
         remarks = EXCLUDED.remarks,
         updated_at = NOW()`,
      [input.shiftLabel, input.busId, input.driverId, input.routeId, input.companyName ?? null, input.remarks ?? null],
    );
  }

  async updateTripPlan(input: {
    tripId: number;
    busId: number;
    driverId: number;
    routeId: number;
    shiftLabel: string;
    companyName?: string;
    remarks?: string;
  }) {
    await ensureTransportEnhancements();
    await query(
      `UPDATE trip_runs
       SET bus_id = $1,
           driver_id = $2,
           route_id = $3,
           shift_label = $4,
           company_name = $5,
           remarks = $6,
           updated_at = NOW()
       WHERE id = $7 AND status = 'planned'`,
      [
        input.busId,
        input.driverId,
        input.routeId,
        input.shiftLabel,
        input.companyName ?? null,
        input.remarks ?? null,
        input.tripId,
      ],
    );
  }

  async startTrip(input: { tripId: number; odometerStartKm: number }) {
    await ensureTransportEnhancements();
    await query(
      `UPDATE trip_runs
       SET status = 'in_progress',
           started_at = NOW(),
           odometer_start_km = $1,
           updated_at = NOW()
       WHERE id = $2 AND status = 'planned'`,
      [input.odometerStartKm, input.tripId],
    );
  }

  async completeTrip(input: { tripId: number; odometerEndKm: number; litersFilled: number; remarks?: string }) {
    await ensureTransportEnhancements();
    const tripResult = await query<{ odometer_start_km: string | null }>(
      `SELECT odometer_start_km::text FROM trip_runs WHERE id = $1`,
      [input.tripId],
    );
    const odometerStart = Number(tripResult.rows[0]?.odometer_start_km ?? 0);
    const kmRun = Math.max(input.odometerEndKm - odometerStart, 0);
    const mileage = input.litersFilled > 0 ? kmRun / input.litersFilled : 0;

    await query(
      `UPDATE trip_runs
       SET status = 'completed',
           completed_at = NOW(),
           odometer_end_km = $1,
           km_run = $2,
           liters_filled = $3,
           mileage_kmpl = $4,
           remarks = COALESCE($5, remarks),
           updated_at = NOW()
       WHERE id = $6 AND status = 'in_progress'`,
      [input.odometerEndKm, kmRun, input.litersFilled, mileage, input.remarks ?? null, input.tripId],
    );
  }

  async cancelTrip(tripId: number) {
    await ensureTransportEnhancements();
    await query(
      `UPDATE trip_runs
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1 AND status IN ('planned', 'in_progress')`,
      [tripId],
    );
  }

  async listRecentAdhocTrips() {
    await ensureTransportEnhancements();
    const result = await query<AdhocTripRow>(
      `SELECT
        at.id,
        at.trip_date::text,
        at.bus_id,
        at.driver_id,
        b.bus_number,
        d.full_name as driver_name,
        at.from_location,
        at.to_location,
        at.trip_days,
        at.remarks
      FROM adhoc_trips at
      JOIN buses b ON b.id = at.bus_id
      JOIN drivers d ON d.id = at.driver_id
      ORDER BY at.trip_date DESC, at.id DESC
      LIMIT 50`,
    );
    return result.rows;
  }

  async createAdhocTrip(input: {
    busId: number;
    driverId: number;
    fromLocation: string;
    toLocation: string;
    tripDays: number;
    remarks?: string;
  }) {
    await ensureTransportEnhancements();
    await query(
      `INSERT INTO adhoc_trips (trip_date, bus_id, driver_id, from_location, to_location, trip_days, remarks)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6)`,
      [
        input.busId,
        input.driverId,
        input.fromLocation.trim(),
        input.toLocation.trim(),
        Math.max(1, Math.floor(input.tripDays)),
        input.remarks?.trim() ? input.remarks.trim() : null,
      ],
    );
  }

  async updateAdhocTrip(input: {
    tripId: number;
    busId: number;
    driverId: number;
    fromLocation: string;
    toLocation: string;
    tripDays: number;
    remarks?: string;
  }) {
    await ensureTransportEnhancements();
    await query(
      `UPDATE adhoc_trips
       SET bus_id = $1,
           driver_id = $2,
           from_location = $3,
           to_location = $4,
           trip_days = $5,
           remarks = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [
        input.busId,
        input.driverId,
        input.fromLocation.trim(),
        input.toLocation.trim(),
        Math.max(1, Math.floor(input.tripDays)),
        input.remarks?.trim() ? input.remarks.trim() : null,
        input.tripId,
      ],
    );
  }
}
