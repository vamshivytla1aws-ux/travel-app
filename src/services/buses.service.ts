import { query } from "@/lib/db";
import { ensureDocumentTables } from "@/lib/document-storage";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { BusesRepository } from "@/repositories/buses.repository";
import { FuelRepository } from "@/repositories/fuel.repository";

const busesRepository = new BusesRepository();
const fuelRepository = new FuelRepository();

export class BusesService {
  async listBuses(search = "", status?: "active" | "maintenance" | "inactive") {
    return busesRepository.list(search, status);
  }

  async getBusDetail(id: number) {
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

    const latestFuel = await fuelRepository.latestByBus(id);
    const fuelHistory = await fuelRepository.listHistoryByBus(id, 12);
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
      latestFuel != null
        ? Number(
            (latestFuel.odometerAfterKm - latestFuel.odometerBeforeKm).toFixed(2),
          )
        : 0;

    return {
      bus,
      assignment: assignmentResult.rows[0] ?? null,
      latestFuel,
      todayMileage,
      fuelHistory,
      maintenance: maintenanceResult.rows,
      documents: busDocuments.rows,
      routeAssignments: routeAssignments.rows,
    };
  }
}
