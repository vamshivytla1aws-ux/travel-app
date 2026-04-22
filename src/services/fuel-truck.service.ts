import { query, withTransaction } from "@/lib/db";
import {
  FuelIssue,
  FuelTruck,
  FuelTruckLedgerEntry,
  FuelTruckRefill,
} from "@/lib/types";
import {
  FuelIssueRow,
  FuelTruckLedgerRow,
  FuelTruckRefillRow,
  FuelTruckRepository,
  FuelTruckRow,
} from "@/repositories/fuel-truck.repository";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

const fuelTruckRepository = new FuelTruckRepository();

type CreateFuelTruckInput = {
  truckCode: string;
  truckName: string;
  registrationNumber: string;
  tankCapacityLiters: number;
  currentAvailableLiters: number;
  lowStockThresholdLiters: number;
  status: "active" | "inactive";
  notes?: string;
  userId?: number | null;
};

type UpdateFuelTruckInput = CreateFuelTruckInput & { id: number };

type AddRefillInput = {
  fuelTruckId: number;
  refillDate: string;
  refillTime: string;
  odometerReading?: number | null;
  fuelStationName?: string;
  vendorName?: string;
  quantityLiters: number;
  ratePerLiter: number;
  totalAmount: number;
  billNumber?: string;
  paymentMode?: string;
  driverName?: string;
  notes?: string;
  receipt?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    data: Buffer;
  } | null;
  userId?: number | null;
};

type AddIssueInput = {
  fuelTruckId: number;
  busId: number;
  issueDate: string;
  issueTime: string;
  litersIssued: number;
  odometerBeforeKm?: number | null;
  odometerAfterKm?: number | null;
  amount?: number;
  companyName?: string;
  issuedByName?: string;
  busDriverName?: string;
  routeReference?: string;
  remarks?: string;
  userId?: number | null;
};

type UpdateIssueInput = {
  issueId: number;
  issueDate: string;
  issueTime: string;
  litersIssued: number;
  odometerBeforeKm?: number | null;
  odometerAfterKm?: number | null;
  amount?: number;
  companyName?: string;
  issuedByName?: string;
  busDriverName?: string;
  routeReference?: string;
  remarks?: string;
  userId?: number | null;
};

type ReportFilters = {
  fromDate?: string;
  toDate?: string;
  fuelTruckId?: number;
  busId?: number;
  fuelStation?: string;
  driver?: string;
};

function mapFuelTruck(row: FuelTruckRow): FuelTruck {
  return {
    id: row.id,
    truckCode: row.truck_code,
    truckName: row.truck_name,
    registrationNumber: row.registration_number,
    tankCapacityLiters: Number(row.tank_capacity_liters),
    currentAvailableLiters: Number(row.current_available_liters),
    lowStockThresholdLiters: Number(row.low_stock_threshold_liters),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRefill(row: FuelTruckRefillRow): FuelTruckRefill {
  return {
    id: row.id,
    fuelTruckId: row.fuel_truck_id,
    refillDate: row.refill_date,
    refillTime: row.refill_time,
    odometerReading: row.odometer_reading ? Number(row.odometer_reading) : null,
    fuelStationName: row.fuel_station_name,
    vendorName: row.vendor_name,
    quantityLiters: Number(row.quantity_liters),
    ratePerLiter: Number(row.rate_per_liter),
    totalAmount: Number(row.total_amount),
    billNumber: row.bill_number,
    paymentMode: row.payment_mode,
    driverName: row.driver_name,
    notes: row.notes,
    receiptFileName: row.receipt_file_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapIssue(row: FuelIssueRow): FuelIssue {
  return {
    id: row.id,
    fuelTruckId: row.fuel_truck_id,
    busId: row.bus_id,
    busNumber: row.bus_number,
    registrationNumber: row.registration_number,
    issueDate: row.issue_date,
    issueTime: row.issue_time,
    litersIssued: Number(row.liters_issued),
    odometerBeforeKm: row.odometer_before_km ? Number(row.odometer_before_km) : null,
    odometerAfterKm: row.odometer_after_km ? Number(row.odometer_after_km) : null,
    amount: Number(row.amount),
    companyName: row.company_name,
    issuedByName: row.issued_by_name,
    busDriverName: row.bus_driver_name,
    routeReference: row.route_reference,
    remarks: row.remarks,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapLedger(row: FuelTruckLedgerRow): FuelTruckLedgerEntry {
  return {
    id: row.id,
    fuelTruckId: row.fuel_truck_id,
    transactionType: row.transaction_type,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    openingStock: Number(row.opening_stock),
    quantityIn: Number(row.quantity_in),
    quantityOut: Number(row.quantity_out),
    closingStock: Number(row.closing_stock),
    remarks: row.remarks,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class FuelTruckService {
  async getLatestOdometerByBusIds(busIds: number[]) {
    await ensureTransportEnhancements();
    if (!busIds.length) return new Map<number, number>();
    const result = await query<{ id: number; odometer_km: string }>(
      `SELECT id, odometer_km::text
       FROM buses
       WHERE id = ANY($1::bigint[])`,
      [busIds],
    );
    return new Map(result.rows.map((row) => [row.id, Number(row.odometer_km)]));
  }

  async listFuelTrucks(search = "", status?: "active" | "inactive") {
    await ensureTransportEnhancements();
    const rows = await fuelTruckRepository.list(search, status);
    return rows.map(mapFuelTruck);
  }

  async getFuelTruck(id: number) {
    await ensureTransportEnhancements();
    const row = await fuelTruckRepository.getById(id);
    return row ? mapFuelTruck(row) : null;
  }

  async getFuelTruckDetail(id: number) {
    await ensureTransportEnhancements();
    const [truckRow, refillRows, issueRows, ledgerRows] = await Promise.all([
      fuelTruckRepository.getById(id),
      fuelTruckRepository.listRefills(id, 30),
      fuelTruckRepository.listIssues(id, 30),
      fuelTruckRepository.listLedger(id, 80),
    ]);
    if (!truckRow) return null;
    return {
      truck: mapFuelTruck(truckRow),
      refills: refillRows.map(mapRefill),
      issues: issueRows.map(mapIssue),
      ledger: ledgerRows.map(mapLedger),
    };
  }

  async createFuelTruck(input: CreateFuelTruckInput) {
    await ensureTransportEnhancements();
    if (input.tankCapacityLiters <= 0) throw new Error("Tank capacity must be positive");
    if (input.currentAvailableLiters < 0) throw new Error("Current stock cannot be negative");
    if (input.currentAvailableLiters > input.tankCapacityLiters) {
      throw new Error("Current stock cannot exceed tank capacity");
    }
    if (input.lowStockThresholdLiters < 0) throw new Error("Low stock threshold cannot be negative");

    const result = await query<{ id: number }>(
      `INSERT INTO fuel_trucks(
        truck_code, truck_name, registration_number, tank_capacity_liters, current_available_liters,
        low_stock_threshold_liters, status, notes, created_by, updated_by
      )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING id`,
      [
        input.truckCode.trim(),
        input.truckName.trim(),
        input.registrationNumber.trim(),
        input.tankCapacityLiters,
        input.currentAvailableLiters,
        input.lowStockThresholdLiters,
        input.status,
        input.notes?.trim() || null,
        input.userId ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async updateFuelTruck(input: UpdateFuelTruckInput) {
    await ensureTransportEnhancements();
    if (input.tankCapacityLiters <= 0) throw new Error("Tank capacity must be positive");
    if (input.currentAvailableLiters < 0) throw new Error("Current stock cannot be negative");
    if (input.currentAvailableLiters > input.tankCapacityLiters) {
      throw new Error("Current stock cannot exceed tank capacity");
    }
    if (input.lowStockThresholdLiters < 0) throw new Error("Low stock threshold cannot be negative");

    await withTransaction(async (client) => {
      const currentResult = await client.query<{ current_available_liters: string }>(
        `SELECT current_available_liters::text
         FROM fuel_trucks
         WHERE id = $1
         FOR UPDATE`,
        [input.id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new Error("Fuel tanker not found");
      const opening = Number(current.current_available_liters);
      const closing = Number(input.currentAvailableLiters.toFixed(2));

      await client.query(
        `UPDATE fuel_trucks
         SET truck_code = $1, truck_name = $2, registration_number = $3, tank_capacity_liters = $4,
             current_available_liters = $5, low_stock_threshold_liters = $6, status = $7, notes = $8,
             updated_by = $9, updated_at = NOW()
         WHERE id = $10`,
        [
          input.truckCode.trim(),
          input.truckName.trim(),
          input.registrationNumber.trim(),
          input.tankCapacityLiters,
          closing,
          input.lowStockThresholdLiters,
          input.status,
          input.notes?.trim() || null,
          input.userId ?? null,
          input.id,
        ],
      );

      if (opening !== closing) {
        const quantityIn = closing > opening ? Number((closing - opening).toFixed(2)) : 0;
        const quantityOut = closing < opening ? Number((opening - closing).toFixed(2)) : 0;
        await client.query(
          `INSERT INTO fuel_truck_ledger(
            fuel_truck_id, transaction_type, reference_id, reference_type, transaction_date, transaction_time,
            opening_stock, quantity_in, quantity_out, closing_stock, remarks, created_by
          )
           VALUES($1,'ADJUSTMENT',NULL,'fuel_trucks',CURRENT_DATE,CURRENT_TIME,$2,$3,$4,$5,$6,$7)`,
          [
            input.id,
            opening,
            quantityIn,
            quantityOut,
            closing,
            input.notes?.trim() || "Manual stock adjustment from tanker update",
            input.userId ?? null,
          ],
        );
      }
    });
  }

  async addRefill(input: AddRefillInput) {
    await ensureTransportEnhancements();
    if (input.quantityLiters <= 0) throw new Error("Quantity must be positive");
    if (input.ratePerLiter <= 0) throw new Error("Rate per liter must be positive");
    if (input.totalAmount < 0) throw new Error("Total amount cannot be negative");
    if (input.odometerReading !== undefined && input.odometerReading !== null && input.odometerReading < 0) {
      throw new Error("Odometer cannot be negative");
    }

    return withTransaction(async (client) => {
      const truckResult = await client.query<{
        id: number;
        status: "active" | "inactive";
        tank_capacity_liters: string;
        current_available_liters: string;
      }>(
        `SELECT id, status, tank_capacity_liters::text, current_available_liters::text
         FROM fuel_trucks
         WHERE id = $1
         FOR UPDATE`,
        [input.fuelTruckId],
      );
      const truck = truckResult.rows[0];
      if (!truck) throw new Error("Fuel truck not found");
      if (truck.status !== "active") throw new Error("Fuel truck is inactive");

      const opening = Number(truck.current_available_liters);
      const capacity = Number(truck.tank_capacity_liters);
      const closing = Number((opening + input.quantityLiters).toFixed(2));
      if (closing > capacity) throw new Error("Refill exceeds tank capacity");

      const refillResult = await client.query<{ id: number }>(
        `INSERT INTO fuel_truck_refills(
          fuel_truck_id, refill_date, refill_time, odometer_reading, fuel_station_name, vendor_name,
          quantity_liters, rate_per_liter, total_amount, bill_number, payment_mode, driver_name, notes,
          receipt_file_name, receipt_mime_type, receipt_size_bytes, receipt_data, created_by
        )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          input.fuelTruckId,
          input.refillDate,
          input.refillTime,
          input.odometerReading ?? null,
          input.fuelStationName?.trim() || null,
          input.vendorName?.trim() || null,
          input.quantityLiters,
          input.ratePerLiter,
          input.totalAmount,
          input.billNumber?.trim() || null,
          input.paymentMode?.trim() || null,
          input.driverName?.trim() || null,
          input.notes?.trim() || null,
          input.receipt?.fileName ?? null,
          input.receipt?.mimeType ?? null,
          input.receipt?.sizeBytes ?? null,
          input.receipt?.data ?? null,
          input.userId ?? null,
        ],
      );
      const refillId = refillResult.rows[0].id;

      await client.query(
        `UPDATE fuel_trucks
         SET current_available_liters = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [closing, input.userId ?? null, input.fuelTruckId],
      );

      await client.query(
        `INSERT INTO fuel_truck_ledger(
          fuel_truck_id, transaction_type, reference_id, reference_type, transaction_date, transaction_time,
          opening_stock, quantity_in, quantity_out, closing_stock, remarks, created_by
        )
         VALUES($1,'REFILL',$2,'fuel_truck_refills',$3,$4,$5,$6,0,$7,$8,$9)`,
        [
          input.fuelTruckId,
          refillId,
          input.refillDate,
          input.refillTime,
          opening,
          input.quantityLiters,
          closing,
          input.notes?.trim() || "Refill",
          input.userId ?? null,
        ],
      );

      return { refillId, openingStock: opening, closingStock: closing };
    });
  }

  async addIssue(input: AddIssueInput) {
    await ensureTransportEnhancements();
    if (input.litersIssued <= 0) throw new Error("Issued liters must be positive");
    if ((input.amount ?? 0) < 0) throw new Error("Amount cannot be negative");
    if (
      input.odometerBeforeKm != null &&
      input.odometerAfterKm != null &&
      input.odometerAfterKm < input.odometerBeforeKm
    ) {
      throw new Error("Odometer end must be greater than or equal to start");
    }

    return withTransaction(async (client) => {
      const truckResult = await client.query<{
        id: number;
        status: "active" | "inactive";
        current_available_liters: string;
      }>(
        `SELECT id, status, current_available_liters::text
         FROM fuel_trucks
         WHERE id = $1
         FOR UPDATE`,
        [input.fuelTruckId],
      );
      const truck = truckResult.rows[0];
      if (!truck) throw new Error("Fuel truck not found");
      if (truck.status !== "active") throw new Error("Fuel truck is inactive");

      const busResult = await client.query<{ id: number; status: string }>(
        `SELECT id, status::text FROM buses WHERE id = $1`,
        [input.busId],
      );
      const bus = busResult.rows[0];
      if (!bus) throw new Error("Bus not found");
      if (bus.status !== "active") throw new Error("Bus is not active");

      const opening = Number(truck.current_available_liters);
      if (input.litersIssued > opening) throw new Error("Issued liters exceed available stock");
      const closing = Number((opening - input.litersIssued).toFixed(2));

      const issueResult = await client.query<{ id: number }>(
        `INSERT INTO fuel_issues(
          fuel_truck_id, bus_id, issue_date, issue_time, liters_issued, odometer_before_km, odometer_after_km, amount, company_name, issued_by_name, bus_driver_name,
          route_reference, remarks, created_by
        )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          input.fuelTruckId,
          input.busId,
          input.issueDate,
          input.issueTime,
          input.litersIssued,
          input.odometerBeforeKm ?? null,
          input.odometerAfterKm ?? null,
          input.amount ?? 0,
          input.companyName?.trim() || null,
          input.issuedByName?.trim() || null,
          input.busDriverName?.trim() || null,
          input.routeReference?.trim() || null,
          input.remarks?.trim() || null,
          input.userId ?? null,
        ],
      );
      const issueId = issueResult.rows[0].id;

      await client.query(
        `UPDATE fuel_trucks
         SET current_available_liters = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [closing, input.userId ?? null, input.fuelTruckId],
      );

      if (input.odometerAfterKm != null) {
        await client.query(
          `UPDATE buses SET odometer_km = $1, updated_at = NOW() WHERE id = $2`,
          [input.odometerAfterKm, input.busId],
        );
      }

      await client.query(
        `INSERT INTO fuel_truck_ledger(
          fuel_truck_id, transaction_type, reference_id, reference_type, transaction_date, transaction_time,
          opening_stock, quantity_in, quantity_out, closing_stock, remarks, created_by
        )
         VALUES($1,'ISSUE',$2,'fuel_issues',$3,$4,$5,0,$6,$7,$8,$9)`,
        [
          input.fuelTruckId,
          issueId,
          input.issueDate,
          input.issueTime,
          opening,
          input.litersIssued,
          closing,
          input.remarks?.trim() || "Issue to bus",
          input.userId ?? null,
        ],
      );

      return { issueId, openingStock: opening, closingStock: closing };
    });
  }

  async updateIssue(input: UpdateIssueInput) {
    await ensureTransportEnhancements();
    if (!Number.isFinite(input.litersIssued) || input.litersIssued <= 0) {
      throw new Error("Issued liters must be positive");
    }
    if ((input.amount ?? 0) < 0) throw new Error("Amount cannot be negative");
    if (
      input.odometerBeforeKm != null &&
      input.odometerAfterKm != null &&
      input.odometerAfterKm < input.odometerBeforeKm
    ) {
      throw new Error("Odometer end must be greater than or equal to start");
    }

    return withTransaction(async (client) => {
      const issueResult = await client.query<{
        id: number;
        fuel_truck_id: number;
        bus_id: number;
        liters_issued: string;
      }>(
        `SELECT id, fuel_truck_id, bus_id, liters_issued::text
         FROM fuel_issues
         WHERE id = $1
         FOR UPDATE`,
        [input.issueId],
      );
      const existing = issueResult.rows[0];
      if (!existing) throw new Error("Issue record not found");

      const truckResult = await client.query<{
        id: number;
        status: "active" | "inactive";
        current_available_liters: string;
      }>(
        `SELECT id, status, current_available_liters::text
         FROM fuel_trucks
         WHERE id = $1
         FOR UPDATE`,
        [existing.fuel_truck_id],
      );
      const truck = truckResult.rows[0];
      if (!truck) throw new Error("Fuel truck not found");
      if (truck.status !== "active") throw new Error("Fuel truck is inactive");

      const currentStock = Number(truck.current_available_liters);
      const previousLiters = Number(existing.liters_issued);
      const delta = Number((input.litersIssued - previousLiters).toFixed(2));
      if (delta > 0 && delta > currentStock) throw new Error("Issued liters exceed available stock");
      const nextStock = Number((currentStock - delta).toFixed(2));

      await client.query(
        `UPDATE fuel_issues
         SET issue_date = $1,
             issue_time = $2,
             liters_issued = $3,
             odometer_before_km = $4,
             odometer_after_km = $5,
             amount = $6,
             company_name = $7,
             issued_by_name = $8,
             bus_driver_name = $9,
             route_reference = $10,
             remarks = $11
         WHERE id = $12`,
        [
          input.issueDate,
          input.issueTime,
          input.litersIssued,
          input.odometerBeforeKm ?? null,
          input.odometerAfterKm ?? null,
          input.amount ?? 0,
          input.companyName?.trim() || null,
          input.issuedByName?.trim() || null,
          input.busDriverName?.trim() || null,
          input.routeReference?.trim() || null,
          input.remarks?.trim() || null,
          input.issueId,
        ],
      );

      if (delta !== 0) {
        await client.query(
          `UPDATE fuel_trucks
           SET current_available_liters = $1, updated_by = $2, updated_at = NOW()
           WHERE id = $3`,
          [nextStock, input.userId ?? null, existing.fuel_truck_id],
        );

        await client.query(
          `INSERT INTO fuel_truck_ledger(
            fuel_truck_id, transaction_type, reference_id, reference_type, transaction_date, transaction_time,
            opening_stock, quantity_in, quantity_out, closing_stock, remarks, created_by
          )
           VALUES($1,'ADJUSTMENT',$2,'fuel_issues',CURRENT_DATE,CURRENT_TIME,$3,$4,$5,$6,$7,$8)`,
          [
            existing.fuel_truck_id,
            input.issueId,
            currentStock,
            delta < 0 ? Math.abs(delta) : 0,
            delta > 0 ? delta : 0,
            nextStock,
            `Issue edit adjustment (issue #${input.issueId})`,
            input.userId ?? null,
          ],
        );
      }

      if (input.odometerAfterKm != null) {
        await client.query(
          `UPDATE buses SET odometer_km = $1, updated_at = NOW() WHERE id = $2`,
          [input.odometerAfterKm, existing.bus_id],
        );
      }

      return { issueId: input.issueId, fuelTruckId: existing.fuel_truck_id, busId: existing.bus_id };
    });
  }

  async getSummary() {
    await ensureTransportEnhancements();
    const [stockRows, todayRows, recentRefills, recentIssues] = await Promise.all([
      query<{
        truck_id: number;
        truck_name: string;
        truck_code: string;
        current_stock: string;
        low_threshold: string;
      }>(
        `SELECT id as truck_id, truck_name, truck_code,
                current_available_liters::text as current_stock,
                low_stock_threshold_liters::text as low_threshold
         FROM fuel_trucks
         WHERE status = 'active'
         ORDER BY truck_name`,
      ),
      query<{ refilled_today: string; issued_today: string }>(
        `SELECT
            COALESCE((SELECT SUM(quantity_liters) FROM fuel_truck_refills WHERE refill_date = CURRENT_DATE), 0)::text as refilled_today,
            COALESCE((SELECT SUM(liters_issued) FROM fuel_issues WHERE issue_date = CURRENT_DATE), 0)::text as issued_today`,
      ),
      query<{ id: number; truck_code: string; quantity_liters: string; refill_date: string; refill_time: string }>(
        `SELECT r.id, t.truck_code, r.quantity_liters::text, r.refill_date::text, r.refill_time::text
         FROM fuel_truck_refills r
         JOIN fuel_trucks t ON t.id = r.fuel_truck_id
         ORDER BY r.refill_date DESC, r.refill_time DESC, r.id DESC
         LIMIT 10`,
      ),
      query<{ id: number; truck_code: string; bus_id: number; liters_issued: string; issue_date: string; issue_time: string }>(
        `SELECT i.id, t.truck_code, i.bus_id, i.liters_issued::text, i.issue_date::text, i.issue_time::text
         FROM fuel_issues i
         JOIN fuel_trucks t ON t.id = i.fuel_truck_id
         ORDER BY i.issue_date DESC, i.issue_time DESC, i.id DESC
         LIMIT 10`,
      ),
    ]);

    const lowStock = stockRows.rows.filter(
      (row) => Number(row.current_stock) <= Number(row.low_threshold),
    );

    return {
      truckStocks: stockRows.rows.map((row) => ({
        truckId: row.truck_id,
        truckName: row.truck_name,
        truckCode: row.truck_code,
        currentStock: Number(row.current_stock),
        lowThreshold: Number(row.low_threshold),
      })),
      today: {
        refilledLiters: Number(todayRows.rows[0]?.refilled_today ?? "0"),
        issuedLiters: Number(todayRows.rows[0]?.issued_today ?? "0"),
      },
      lowStock: lowStock.map((row) => ({
        truckId: row.truck_id,
        truckName: row.truck_name,
        truckCode: row.truck_code,
        currentStock: Number(row.current_stock),
      })),
      recentRefills: recentRefills.rows,
      recentIssues: recentIssues.rows,
    };
  }

  async getReports(filters: ReportFilters) {
    await ensureTransportEnhancements();
    const refillParams: unknown[] = [];
    const issueParams: unknown[] = [];
    const ledgerParams: unknown[] = [];
    const refillWhere: string[] = [];
    const issueWhere: string[] = [];
    const ledgerWhere: string[] = [];

    if (filters.fromDate) {
      refillParams.push(filters.fromDate);
      issueParams.push(filters.fromDate);
      ledgerParams.push(filters.fromDate);
      refillWhere.push(`r.refill_date >= $${refillParams.length}`);
      issueWhere.push(`i.issue_date >= $${issueParams.length}`);
      ledgerWhere.push(`l.transaction_date >= $${ledgerParams.length}`);
    }
    if (filters.toDate) {
      refillParams.push(filters.toDate);
      issueParams.push(filters.toDate);
      ledgerParams.push(filters.toDate);
      refillWhere.push(`r.refill_date <= $${refillParams.length}`);
      issueWhere.push(`i.issue_date <= $${issueParams.length}`);
      ledgerWhere.push(`l.transaction_date <= $${ledgerParams.length}`);
    }
    if (filters.fuelTruckId) {
      refillParams.push(filters.fuelTruckId);
      issueParams.push(filters.fuelTruckId);
      ledgerParams.push(filters.fuelTruckId);
      refillWhere.push(`r.fuel_truck_id = $${refillParams.length}`);
      issueWhere.push(`i.fuel_truck_id = $${issueParams.length}`);
      ledgerWhere.push(`l.fuel_truck_id = $${ledgerParams.length}`);
    }
    if (filters.busId) {
      issueParams.push(filters.busId);
      issueWhere.push(`i.bus_id = $${issueParams.length}`);
    }
    if (filters.fuelStation?.trim()) {
      refillParams.push(`%${filters.fuelStation.trim()}%`);
      refillWhere.push(`COALESCE(r.fuel_station_name, '') ILIKE $${refillParams.length}`);
    }
    if (filters.driver?.trim()) {
      refillParams.push(`%${filters.driver.trim()}%`);
      issueParams.push(`%${filters.driver.trim()}%`);
      refillWhere.push(`COALESCE(r.driver_name, '') ILIKE $${refillParams.length}`);
      issueWhere.push(`COALESCE(i.bus_driver_name, '') ILIKE $${issueParams.length}`);
    }

    const refillSql = refillWhere.length ? `WHERE ${refillWhere.join(" AND ")}` : "";
    const issueSql = issueWhere.length ? `WHERE ${issueWhere.join(" AND ")}` : "";
    const ledgerSql = ledgerWhere.length ? `WHERE ${ledgerWhere.join(" AND ")}` : "";

    const [refillReport, issueReport, truckWiseStock, busWiseIssue, dailySummary, monthlySummary] =
      await Promise.all([
        query<{
          truck_code: string;
          fuel_station_name: string | null;
          vendor_name: string | null;
          quantity_liters: string;
          total_amount: string;
          refill_date: string;
        }>(
          `SELECT t.truck_code, r.fuel_station_name, r.vendor_name, r.quantity_liters::text, r.total_amount::text, r.refill_date::text
           FROM fuel_truck_refills r
           JOIN fuel_trucks t ON t.id = r.fuel_truck_id
           ${refillSql}
           ORDER BY r.refill_date DESC, r.id DESC
           LIMIT 300`,
          refillParams,
        ),
        query<{
          truck_code: string;
          bus_id: number;
          liters_issued: string;
          issue_date: string;
        }>(
          `SELECT t.truck_code, i.bus_id, i.liters_issued::text, i.issue_date::text
           FROM fuel_issues i
           JOIN fuel_trucks t ON t.id = i.fuel_truck_id
           ${issueSql}
           ORDER BY i.issue_date DESC, i.id DESC
           LIMIT 300`,
          issueParams,
        ),
        query<{ truck_code: string; current_stock: string }>(
          `SELECT truck_code, current_available_liters::text as current_stock
           FROM fuel_trucks
           ORDER BY truck_code`,
        ),
        query<{ bus_id: number; total_issued: string }>(
          `SELECT i.bus_id, SUM(i.liters_issued)::text as total_issued
           FROM fuel_issues i
           ${issueSql}
           GROUP BY i.bus_id
           ORDER BY i.bus_id`,
          issueParams,
        ),
        query<{ day: string; qty_in: string; qty_out: string }>(
          `SELECT l.transaction_date::text as day,
                  SUM(l.quantity_in)::text as qty_in,
                  SUM(l.quantity_out)::text as qty_out
           FROM fuel_truck_ledger l
           ${ledgerSql}
           GROUP BY l.transaction_date
           ORDER BY l.transaction_date DESC
           LIMIT 60`,
          ledgerParams,
        ),
        query<{ month: string; qty_in: string; qty_out: string }>(
          `SELECT TO_CHAR(l.transaction_date, 'YYYY-MM') as month,
                  SUM(l.quantity_in)::text as qty_in,
                  SUM(l.quantity_out)::text as qty_out
           FROM fuel_truck_ledger l
           ${ledgerSql}
           GROUP BY TO_CHAR(l.transaction_date, 'YYYY-MM')
           ORDER BY month DESC
           LIMIT 12`,
          ledgerParams,
        ),
      ]);

    return {
      refillReport: refillReport.rows,
      issueReport: issueReport.rows,
      truckWiseStock: truckWiseStock.rows,
      busWiseIssue: busWiseIssue.rows,
      dailySummary: dailySummary.rows,
      monthlySummary: monthlySummary.rows,
    };
  }
}

