import { query } from "@/lib/db";

export type FuelTruckRow = {
  id: number;
  truck_code: string;
  truck_name: string;
  registration_number: string;
  tank_capacity_liters: string;
  current_available_liters: string;
  low_stock_threshold_liters: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FuelTruckRefillRow = {
  id: number;
  fuel_truck_id: number;
  refill_date: string;
  refill_time: string;
  odometer_reading: string | null;
  fuel_station_name: string | null;
  vendor_name: string | null;
  quantity_liters: string;
  rate_per_liter: string;
  total_amount: string;
  bill_number: string | null;
  payment_mode: string | null;
  driver_name: string | null;
  notes: string | null;
  receipt_file_name: string | null;
  created_by: number | null;
  created_at: string;
};

export type FuelIssueRow = {
  id: number;
  fuel_truck_id: number;
  bus_id: number;
  bus_number: string | null;
  registration_number: string | null;
  issue_date: string;
  issue_time: string;
  liters_issued: string;
  issued_by_name: string | null;
  bus_driver_name: string | null;
  route_reference: string | null;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
};

export type FuelTruckLedgerRow = {
  id: number;
  fuel_truck_id: number;
  transaction_type: "REFILL" | "ISSUE" | "ADJUSTMENT";
  reference_id: number | null;
  reference_type: string | null;
  transaction_date: string;
  transaction_time: string;
  opening_stock: string;
  quantity_in: string;
  quantity_out: string;
  closing_stock: string;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
};

export class FuelTruckRepository {
  async list(search = "", status?: "active" | "inactive") {
    const params: unknown[] = [];
    const where: string[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(
        `(truck_code ILIKE $${params.length} OR truck_name ILIKE $${params.length} OR registration_number ILIKE $${params.length})`,
      );
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query<FuelTruckRow>(
      `SELECT id, truck_code, truck_name, registration_number, tank_capacity_liters::text, current_available_liters::text,
              low_stock_threshold_liters::text, status, notes, created_at::text, updated_at::text
       FROM fuel_trucks
       ${whereSql}
       ORDER BY id DESC`,
      params,
    );
    return result.rows;
  }

  async getById(id: number) {
    const result = await query<FuelTruckRow>(
      `SELECT id, truck_code, truck_name, registration_number, tank_capacity_liters::text, current_available_liters::text,
              low_stock_threshold_liters::text, status, notes, created_at::text, updated_at::text
       FROM fuel_trucks
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listRefills(fuelTruckId: number, limit = 20) {
    const result = await query<FuelTruckRefillRow>(
      `SELECT id, fuel_truck_id, refill_date::text, refill_time::text, odometer_reading::text, fuel_station_name, vendor_name,
              quantity_liters::text, rate_per_liter::text, total_amount::text, bill_number, payment_mode, driver_name, notes,
              receipt_file_name, created_by, created_at::text
       FROM fuel_truck_refills
       WHERE fuel_truck_id = $1
       ORDER BY refill_date DESC, refill_time DESC, id DESC
       LIMIT $2`,
      [fuelTruckId, limit],
    );
    return result.rows;
  }

  async listIssues(fuelTruckId: number, limit = 20) {
    const result = await query<FuelIssueRow>(
      `SELECT fi.id, fi.fuel_truck_id, fi.bus_id, b.bus_number, b.registration_number, fi.issue_date::text, fi.issue_time::text,
              fi.liters_issued::text, fi.issued_by_name, fi.bus_driver_name, fi.route_reference, fi.remarks, fi.created_by, fi.created_at::text
       FROM fuel_issues fi
       LEFT JOIN buses b ON b.id = fi.bus_id
       WHERE fi.fuel_truck_id = $1
       ORDER BY fi.issue_date DESC, fi.issue_time DESC, fi.id DESC
       LIMIT $2`,
      [fuelTruckId, limit],
    );
    return result.rows;
  }

  async listLedger(fuelTruckId: number, limit = 50) {
    const result = await query<FuelTruckLedgerRow>(
      `SELECT id, fuel_truck_id, transaction_type, reference_id, reference_type, transaction_date::text, transaction_time::text,
              opening_stock::text, quantity_in::text, quantity_out::text, closing_stock::text, remarks, created_by, created_at::text
       FROM fuel_truck_ledger
       WHERE fuel_truck_id = $1
       ORDER BY transaction_date DESC, transaction_time DESC, id DESC
       LIMIT $2`,
      [fuelTruckId, limit],
    );
    return result.rows;
  }
}

