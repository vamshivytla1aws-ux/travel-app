import { ensureDocumentTables } from "@/lib/document-storage";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversRepository } from "@/repositories/drivers.repository";

const driversRepository = new DriversRepository();

export class DriversService {
  async listDrivers() {
    await ensureTransportEnhancements();
    return driversRepository.list();
  }

  async getDriverProfile(id: number) {
    await ensureTransportEnhancements();
    await ensureDocumentTables();
    const driverResult = await query<{
      id: number;
      full_name: string;
      phone: string;
      company_name: string | null;
      bank_name: string | null;
      bank_account_number: string | null;
      bank_ifsc: string | null;
      pf_account_number: string | null;
      uan_number: string | null;
      license_number: string;
      license_expiry: string;
      experience_years: number;
      has_profile_photo: boolean;
      is_active: boolean;
    }>(
      `SELECT id, full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number,
              license_number, license_expiry::text, experience_years, (profile_photo_data IS NOT NULL) as has_profile_photo, is_active
       FROM drivers
       WHERE id = $1`,
      [id],
    );

    const driver = driverResult.rows[0];
    if (!driver) return null;

    const documents = await query<{
      id: number;
      document_type: string;
      document_name: string;
      file_name: string | null;
      mime_type: string | null;
      file_size_bytes: number | null;
      uploaded_at: string;
    }>(
      `SELECT id, document_type, document_name, file_name, mime_type, file_size_bytes, uploaded_at::text
       FROM driver_documents
       WHERE driver_id = $1
       ORDER BY uploaded_at DESC`,
      [id],
    );

    const routeAssignments = await query<{
      id: number;
      assignment_date: string;
      route_name: string;
      shift: string;
      company_name: string | null;
      bus_registration_number: string;
    }>(
      `SELECT
          rp.id,
          rp.assignment_date::text,
          rp.route_name,
          rp.shift::text,
          rp.company_name,
          b.registration_number as bus_registration_number
       FROM route_planner_entries rp
       JOIN buses b ON b.id = rp.bus_id
       WHERE rp.driver_id = $1 AND rp.is_active = true
       ORDER BY rp.assignment_date DESC, rp.id DESC
       LIMIT 25`,
      [id],
    );

    return {
      driver,
      documents: documents.rows,
      routeAssignments: routeAssignments.rows,
    };
  }
}
