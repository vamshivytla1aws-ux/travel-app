import PDFDocument from "pdfkit";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { MODULE_EXPORT_FIELDS, type ExportModuleKey } from "@/lib/module-export";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

type ExportRow = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeCsv(value: unknown) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function normalizeModule(raw: string): ExportModuleKey {
  const value = raw.trim().toLowerCase();
  if (value in MODULE_EXPORT_FIELDS) return value as ExportModuleKey;
  return "overall";
}

function buildWhere(baseAlias: string, params: unknown[], input: { q?: string; status?: string; from?: string; to?: string; dateColumn?: string; searchCols?: string[]; statusCol?: string }) {
  const where: string[] = [];
  if (input.q?.trim() && input.searchCols?.length) {
    params.push(`%${input.q.trim()}%`);
    where.push(`(${input.searchCols.map((col) => `${baseAlias}.${col} ILIKE $${params.length}`).join(" OR ")})`);
  }
  if (input.status?.trim() && input.statusCol) {
    params.push(input.status.trim());
    where.push(`${baseAlias}.${input.statusCol}::text ILIKE $${params.length}`);
  }
  if (input.from?.trim() && input.dateColumn) {
    params.push(input.from.trim());
    where.push(`DATE(${baseAlias}.${input.dateColumn}) >= $${params.length}`);
  }
  if (input.to?.trim() && input.dateColumn) {
    params.push(input.to.trim());
    where.push(`DATE(${baseAlias}.${input.dateColumn}) <= $${params.length}`);
  }
  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

async function fetchRows(moduleKey: ExportModuleKey, q?: string, status?: string, from?: string, to?: string): Promise<ExportRow[]> {
  const params: unknown[] = [];
  switch (moduleKey) {
    case "buses": {
      const where = buildWhere("b", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["bus_number", "registration_number", "make", "model"], statusCol: "status" });
      const result = await query<ExportRow>(
        `WITH fuel_history AS (
           SELECT
             fe.id,
             fe.bus_id,
             fe.filled_at,
             DATE(fe.filled_at) AS metric_day,
             fe.odometer_before_km,
             fe.odometer_after_km,
             fe.liters,
             fe.amount,
             fe.company_name
           FROM fuel_entries fe
           UNION ALL
           SELECT
             fi.id,
             fi.bus_id,
             (fi.issue_date::text || 'T' || fi.issue_time::text)::timestamp AS filled_at,
             fi.issue_date AS metric_day,
             fi.odometer_before_km,
             fi.odometer_after_km,
             fi.liters_issued AS liters,
             fi.amount,
             fi.company_name
           FROM fuel_issues fi
         )
         SELECT
           b.id::text,
           b.bus_number,
           b.registration_number,
           b.make,
           b.model,
           b.seater::text,
           b.status::text,
           b.odometer_km::text,
           pd.previous_day_mileage_kmpl,
           COALESCE(SUM(fh.liters), 0)::text AS total_fuel_liters,
           COALESCE(SUM(fh.amount), 0)::text AS total_fuel_amount,
           COALESCE(SUM(CASE WHEN fh.odometer_before_km IS NOT NULL AND fh.odometer_after_km IS NOT NULL THEN fh.odometer_after_km - fh.odometer_before_km ELSE 0 END), 0)::text AS total_km_run,
           CASE
             WHEN COALESCE(SUM(fh.liters), 0) > 0 THEN
               (
                 COALESCE(SUM(CASE WHEN fh.odometer_before_km IS NOT NULL AND fh.odometer_after_km IS NOT NULL THEN fh.odometer_after_km - fh.odometer_before_km ELSE 0 END), 0)
                 / NULLIF(SUM(fh.liters), 0)
               )::text
             ELSE NULL
           END AS overall_mileage_kmpl,
           TO_CHAR(MAX(fh.filled_at), 'YYYY-MM-DD"T"HH24:MI:SS') AS last_fuel_date,
           MAX(CASE WHEN fh.filled_at = lf.latest_filled_at THEN fh.odometer_before_km END)::text AS last_odometer_start,
           MAX(CASE WHEN fh.filled_at = lf.latest_filled_at THEN fh.odometer_after_km END)::text AS last_odometer_end,
           MAX(CASE WHEN fh.filled_at = lf.latest_filled_at THEN fh.liters END)::text AS last_fuel_liters,
           MAX(CASE WHEN fh.filled_at = lf.latest_filled_at THEN fh.amount END)::text AS last_fuel_amount,
           MAX(CASE WHEN fh.filled_at = lf.latest_filled_at THEN fh.company_name END) AS last_company_name
         FROM buses b
         LEFT JOIN fuel_history fh ON fh.bus_id = b.id
         LEFT JOIN LATERAL (
           SELECT MAX(fh2.filled_at) AS latest_filled_at
           FROM fuel_history fh2
           WHERE fh2.bus_id = b.id
         ) lf ON true
         LEFT JOIN LATERAL (
           SELECT
             (
               SUM(fh3.odometer_after_km - fh3.odometer_before_km) /
               NULLIF(SUM(fh3.liters), 0)
             )::text AS previous_day_mileage_kmpl
           FROM fuel_history fh3
           WHERE
             fh3.bus_id = b.id
             AND fh3.metric_day = CURRENT_DATE - INTERVAL '1 day'
             AND fh3.odometer_before_km IS NOT NULL
             AND fh3.odometer_after_km IS NOT NULL
         ) pd ON true
         ${where}
         GROUP BY b.id, b.bus_number, b.registration_number, b.make, b.model, b.seater, b.status, b.odometer_km, pd.previous_day_mileage_kmpl
         ORDER BY b.id DESC`,
        params,
      );
      return result.rows;
    }
    case "drivers": {
      const where = buildWhere("d", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["full_name", "phone", "license_number", "company_name"], statusCol: "is_active" });
      const result = await query<ExportRow>(
        `SELECT
           d.id::text,
           d.full_name,
           d.phone,
           d.company_name,
           dp.blood_group,
           dp.father_name,
           dp.father_contact,
           dp.mother_name,
           dp.mother_contact,
           dp.spouse_name,
           dp.spouse_contact,
           dp.child_1_name,
           dp.child_2_name,
           dp.pan_or_voter_id,
           dp.aadhaar_no,
           d.bank_name,
           d.bank_account_number,
           d.bank_ifsc,
           dp.vehicle_registration_no,
           dp.present_reading_km::text,
           d.license_number,
           d.license_expiry::text,
           dp.badge_no,
           dp.badge_validity::text,
           dp.education,
           d.experience_years::text,
           dp.date_of_birth::text,
           dp.marital_status,
           dp.religion,
           dp.present_village,
           dp.present_landmark,
           dp.present_post_office,
           dp.present_mandal,
           dp.present_police_station,
           dp.present_district,
           dp.present_state,
           dp.present_pin_code,
           dp.permanent_village,
           dp.permanent_landmark,
           dp.permanent_post_office,
           dp.permanent_mandal,
           dp.permanent_police_station,
           dp.permanent_district,
           dp.permanent_state,
           dp.permanent_pin_code,
           dp.reference1_name,
           dp.reference1_relationship,
           dp.reference1_contact,
           dp.reference2_name,
           dp.reference2_relationship,
           dp.reference2_contact,
           dp.present_salary::text,
           dp.salary_expectation::text,
           dp.salary_offered::text,
           dp.joining_date::text,
           dp.candidate_signature_text,
           dp.appointee_signature_text,
           dp.approval_authority_signature_text,
           d.is_active::text,
           d.updated_at::text
         FROM drivers d
         LEFT JOIN driver_profiles dp ON dp.driver_id = d.id
         ${where}
         ORDER BY d.id DESC`,
        params,
      );
      return result.rows;
    }
    case "employees": {
      const where = buildWhere("e", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["employee_code", "full_name", "phone", "department", "company_name"], statusCol: "is_active" });
      const result = await query<ExportRow>(
        `SELECT e.employee_code, e.full_name, e.phone, e.department, e.company_name, e.is_active::text
         FROM employees e
         ${where}
         ORDER BY e.id DESC`,
        params,
      );
      return result.rows;
    }
    case "routes": {
      const where = buildWhere("rp", params, { q, status, from, to, dateColumn: "assignment_date", searchCols: ["route_name", "company_name", "shift"], statusCol: "is_active" });
      const result = await query<ExportRow>(
        `SELECT rp.assignment_date::text, rp.route_name, rp.shift::text, rp.company_name, b.registration_number as bus_registration_number, d.full_name as driver_name
         FROM route_planner_entries rp
         JOIN buses b ON b.id = rp.bus_id
         JOIN drivers d ON d.id = rp.driver_id
         ${where}
         ORDER BY rp.assignment_date DESC, rp.id DESC`,
        params,
      );
      return result.rows;
    }
    case "trips": {
      const where = buildWhere("t", params, { q, status, from, to, dateColumn: "trip_date", searchCols: ["shift_label", "status"], statusCol: "status" });
      const result = await query<ExportRow>(
        `SELECT t.trip_date::text, t.status::text, b.bus_number, d.full_name as driver_name, r.route_name, t.shift_label, t.km_run::text, t.mileage_kmpl::text
         FROM trip_runs t
         JOIN buses b ON b.id = t.bus_id
         JOIN drivers d ON d.id = t.driver_id
         JOIN routes r ON r.id = t.route_id
         ${where}
         ORDER BY t.trip_date DESC, t.id DESC`,
        params,
      );
      return result.rows;
    }
    case "tracking": {
      const where = buildWhere("g", params, { q, status, from, to, dateColumn: "logged_at", searchCols: ["latitude", "longitude"], statusCol: undefined });
      const result = await query<ExportRow>(
        `SELECT g.logged_at::text, b.bus_number, g.latitude::text, g.longitude::text, g.speed_kmph::text
         FROM gps_logs g
         JOIN buses b ON b.id = g.bus_id
         ${where}
         ORDER BY g.logged_at DESC
         LIMIT 1000`,
        params,
      );
      return result.rows;
    }
    case "fuel-trucks": {
      const where = buildWhere("i", params, { q, status, from, to, dateColumn: "issue_date", searchCols: ["company_name", "truck_code", "registration_number"], statusCol: undefined });
      const result = await query<ExportRow>(
        `SELECT i.issue_date::text, t.truck_code, b.registration_number, i.liters_issued::text, i.amount::text, i.company_name
         FROM fuel_issues i
         JOIN fuel_trucks t ON t.id = i.fuel_truck_id
         LEFT JOIN buses b ON b.id = i.bus_id
         ${where}
         ORDER BY i.issue_date DESC, i.id DESC`,
        params,
      );
      return result.rows;
    }
    case "finance": {
      const where = buildWhere("f", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["registration_no", "vehicle_type_or_bus_name", "financier_bank_name", "loan_account_number"], statusCol: "status" });
      const result = await query<ExportRow>(
        `SELECT f.registration_no, f.vehicle_type_or_bus_name, f.financier_bank_name, f.loan_amount_taken::text, f.emi_amount::text, f.outstanding_principal::text, f.status::text
         FROM finance_loans f
         ${where}
         ORDER BY f.id DESC`,
        params,
      );
      return result.rows;
    }
    case "logs": {
      const where = buildWhere("a", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["user_email", "action", "entity_type"], statusCol: undefined });
      const result = await query<ExportRow>(
        `SELECT a.created_at::text, a.user_email, a.action, a.entity_type, a.entity_id::text
         FROM audit_logs a
         ${where}
         ORDER BY a.created_at DESC
         LIMIT 1000`,
        params,
      );
      return result.rows;
    }
    case "users": {
      const where = buildWhere("u", params, { q, status, from, to, dateColumn: "updated_at", searchCols: ["full_name", "email", "role"], statusCol: "is_active" });
      const result = await query<ExportRow>(
        `SELECT u.full_name, u.email, u.role::text, u.is_active::text, u.updated_at::text
         FROM users u
         ${where}
         ORDER BY u.id DESC`,
        params,
      );
      return result.rows;
    }
    case "overall":
    default: {
      const result = await query<ExportRow>(
        `SELECT * FROM (
          SELECT 'buses' AS module, COUNT(*)::text AS total_records, COUNT(*) FILTER (WHERE status = 'active')::text AS active_records, MAX(updated_at)::text AS last_updated FROM buses
          UNION ALL
          SELECT 'drivers', COUNT(*)::text, COUNT(*) FILTER (WHERE is_active = true)::text, MAX(updated_at)::text FROM drivers
          UNION ALL
          SELECT 'employees', COUNT(*)::text, COUNT(*) FILTER (WHERE is_active = true)::text, MAX(updated_at)::text FROM employees
          UNION ALL
          SELECT 'routes', COUNT(*)::text, COUNT(*) FILTER (WHERE is_active = true)::text, MAX(updated_at)::text FROM routes
          UNION ALL
          SELECT 'trips', COUNT(*)::text, COUNT(*) FILTER (WHERE status = 'in_progress')::text, MAX(updated_at)::text FROM trip_runs
          UNION ALL
          SELECT 'fuel-trucks', COUNT(*)::text, COUNT(*) FILTER (WHERE status = 'active')::text, MAX(updated_at)::text FROM fuel_trucks
          UNION ALL
          SELECT 'finance', COUNT(*)::text, COUNT(*) FILTER (WHERE status = 'active')::text, MAX(updated_at)::text FROM finance_loans
          UNION ALL
          SELECT 'logs', COUNT(*)::text, COUNT(*)::text, MAX(created_at)::text FROM audit_logs
          UNION ALL
          SELECT 'users', COUNT(*)::text, COUNT(*) FILTER (WHERE is_active = true)::text, MAX(updated_at)::text FROM users
        ) x`,
      );
      return result.rows;
    }
  }
}

function pickFields(rows: ExportRow[], fields: string[]) {
  if (!rows.length) return rows;
  if (!fields.length) return rows;
  return rows.map((row) => {
    const next: ExportRow = {};
    for (const key of fields) next[key] = row[key] ?? null;
    return next;
  });
}

export async function GET(request: Request) {
  await ensureTransportEnhancements();
  const url = new URL(request.url);
  const moduleKey = normalizeModule(url.searchParams.get("module") ?? "overall");
  const authModule =
    moduleKey === "overall"
      ? "dashboard"
      : moduleKey === "fuel-trucks"
        ? "fuel-truck"
        : moduleKey === "users"
          ? "user-admin"
          : moduleKey;
  const session = await requireApiModuleAccess(authModule as never);
  if (!session) return new Response("Forbidden", { status: 403 });

  const format = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const selectedFields = url.searchParams.getAll("field");

  const rawRows = await fetchRows(moduleKey, q, status, from, to);
  const rows = pickFields(rawRows, selectedFields);
  const headers = rows.length ? Object.keys(rows[0]) : (selectedFields.length ? selectedFields : MODULE_EXPORT_FIELDS[moduleKey].map((f) => f.key));

  if (format === "excel") {
    const csvLines = [headers.join(",")];
    for (const row of rows) {
      csvLines.push(headers.map((key) => escapeCsv(row[key])).join(","));
    }
    const csv = csvLines.join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${moduleKey}-export.csv"`,
      },
    });
  }

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).font("Helvetica-Bold").text(`${moduleKey.toUpperCase()} Export Report`);
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#4b5563").text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Records: ${rows.length}`);
  doc.moveDown(0.4);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8).text(headers.join(" | "));
  doc.moveDown(0.2);
  doc.moveTo(36, doc.y).lineTo(560, doc.y).strokeColor("#d1d5db").stroke();
  doc.moveDown(0.3);

  rows.forEach((row) => {
    const line = headers.map((h) => `${h}: ${row[h] ?? "-"}`).join(" | ");
    doc.fillColor("#111827").font("Helvetica").fontSize(8).text(line, {
      width: 523,
      lineGap: 1,
    });
    doc.moveDown(0.15);
    if (doc.y > 800) {
      doc.addPage();
    }
  });

  doc.end();
  const pdfBuffer = await done;
  const binary = new Uint8Array(pdfBuffer);
  return new Response(binary, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${moduleKey}-export.pdf"`,
    },
  });
}
