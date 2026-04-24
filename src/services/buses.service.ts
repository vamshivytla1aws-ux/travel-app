import { query } from "@/lib/db";
import { ensureDocumentTables } from "@/lib/document-storage";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { BusesRepository } from "@/repositories/buses.repository";
import { FuelRepository } from "@/repositories/fuel.repository";

const busesRepository = new BusesRepository();
const fuelRepository = new FuelRepository();

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export class BusesService {
  async listBuses(search = "", status?: "active" | "maintenance" | "inactive") {
    return busesRepository.list(search, status);
  }

  async listBusesPaged(input: {
    search?: string;
    status?: "active" | "maintenance" | "inactive";
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const result = await busesRepository.listPaged(
      input.search ?? "",
      input.status,
      page,
      limit,
    );
    return {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / Math.max(limit, 1))),
      },
    };
  }

  async createBus(input: {
    busNumber: string;
    registrationNumber: string;
    make: string;
    model: string;
    seater: number;
    odometerKm: number;
    status?: "active" | "maintenance" | "inactive";
  }) {
    const existing = await query<{ id: number }>(
      `SELECT id FROM buses WHERE bus_number = $1 OR registration_number = $2 LIMIT 1`,
      [input.busNumber, input.registrationNumber],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return { error: "duplicate" as const };
    }
    const bus = await busesRepository.create(input);
    return { bus };
  }

  async updateBus(
    id: number,
    input: {
      busNumber: string;
      registrationNumber: string;
      make: string;
      model: string;
      seater: number;
      odometerKm: number;
      status: "active" | "maintenance" | "inactive";
    },
  ) {
    const duplicate = await query<{ id: number }>(
      `SELECT id FROM buses
       WHERE (bus_number = $1 OR registration_number = $2) AND id <> $3
       LIMIT 1`,
      [input.busNumber, input.registrationNumber, id],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return { error: "duplicate" as const };
    }
    const bus = await busesRepository.update(id, input);
    if (!bus) return { error: "not_found" as const };
    return { bus };
  }

  async deleteBus(id: number) {
    const ok = await busesRepository.hardDelete(id);
    if (!ok) return { error: "not_found" as const };
    return { success: true as const };
  }

  async getBusDetail(
    id: number,
    options?: {
      fuelPage?: number;
      fuelPageSize?: number;
    },
  ) {
    await ensureTransportEnhancements();
    await ensureDocumentTables();
    const bus = await busesRepository.getById(id);
    if (!bus) {
      return null;
    }

    const assignmentResult = await query<{
      driver_name: string;
      driver_phone: string;
      route_name: string;
      route_code: string;
      assignment_status: string;
      employee_count: string;
    }>(
      `SELECT
          d.full_name as driver_name,
          d.phone as driver_phone,
          r.route_name,
          r.route_code,
          ba.status::text as assignment_status,
          (
            SELECT COUNT(*)
            FROM employee_assignments ea
            WHERE ea.bus_assignment_id = ba.id
          )::text as employee_count
       FROM bus_assignments ba
       JOIN drivers d ON d.id = ba.driver_id
       JOIN routes r ON r.id = ba.route_id
       WHERE ba.bus_id = $1 AND ba.assignment_date = CURRENT_DATE
       ORDER BY ba.id DESC
       LIMIT 1`,
      [id],
    );

    const maintenanceResult = await query<{
      id: number;
      maintenance_date: string;
      issue_type: string;
      description: string;
      cost: string;
    }>(
      `SELECT id, maintenance_date, issue_type, description, cost
       FROM maintenance_records
       WHERE bus_id = $1
       ORDER BY maintenance_date DESC
       LIMIT 10`,
      [id],
    );

    const fuelPageSizeRaw = options?.fuelPageSize ?? 10;
    const fuelPageRaw = options?.fuelPage ?? 1;
    const fuelPageSize = Number.isFinite(fuelPageSizeRaw)
      ? Math.min(50, Math.max(5, Math.floor(fuelPageSizeRaw)))
      : 10;
    const fuelPage = Number.isFinite(fuelPageRaw) ? Math.max(1, Math.floor(fuelPageRaw)) : 1;
    const allFuelHistory = await fuelRepository.listUnifiedHistoryByBus(id, 1000);
    const fuelTotal = allFuelHistory.length;
    const fuelTotalPages = Math.max(1, Math.ceil(fuelTotal / fuelPageSize));
    const safeFuelPage = Math.min(fuelPage, fuelTotalPages);
    const fuelOffset = (safeFuelPage - 1) * fuelPageSize;
    const fuelHistory = allFuelHistory.slice(fuelOffset, fuelOffset + fuelPageSize);
    const latestFuel = fuelHistory[0] ?? null;
    const busDocuments = await query<{
      id: number;
      document_type: string;
      document_name: string;
      file_name: string | null;
      mime_type: string | null;
      file_size_bytes: number | null;
      uploaded_at: string;
    }>(
      `SELECT id, document_type, document_name, file_name, mime_type, file_size_bytes, uploaded_at::text
       FROM bus_documents
       WHERE bus_id = $1
       ORDER BY uploaded_at DESC`,
      [id],
    );
    const routeAssignments = await query<{
      id: number;
      assignment_date: string;
      route_name: string;
      shift: string;
      company_name: string | null;
      driver_name: string;
    }>(
      `SELECT
          rp.id,
          rp.assignment_date::text,
          rp.route_name,
          rp.shift::text,
          rp.company_name,
          d.full_name as driver_name
       FROM route_planner_entries rp
       JOIN drivers d ON d.id = rp.driver_id
       WHERE rp.bus_id = $1 AND rp.is_active = true
       ORDER BY rp.assignment_date DESC, rp.id DESC
       LIMIT 25`,
      [id],
    );
    const todayMileage =
      latestFuel != null &&
      latestFuel.odometerAfterKm != null &&
      latestFuel.odometerBeforeKm != null
        ? Number((latestFuel.odometerAfterKm - latestFuel.odometerBeforeKm).toFixed(2))
        : null;
    const normalizedBusRegistration = normalizeRegistration(bus.registrationNumber);
    const financeMatch = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM finance_loans
       WHERE regexp_replace(upper(registration_no), '[^A-Z0-9]', '', 'g') = $1`,
      [normalizedBusRegistration],
    );
    const hasFinance = Number(financeMatch.rows[0]?.total ?? "0") > 0;

    return {
      bus,
      assignment: assignmentResult.rows[0] ?? null,
      latestFuel,
      todayMileage,
      fuelHistory,
      fuelPagination: {
        page: safeFuelPage,
        pageSize: fuelPageSize,
        total: fuelTotal,
        totalPages: fuelTotalPages,
      },
      maintenance: maintenanceResult.rows,
      documents: busDocuments.rows,
      routeAssignments: routeAssignments.rows,
      hasFinance,
    };
  }
}
