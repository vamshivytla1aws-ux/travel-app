import PDFDocument from "pdfkit";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { MODULE_EXPORT_FIELDS, type ExportModuleKey } from "@/lib/module-export";

type ExportRow = Record<string, string | number | boolean | null>;

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
        `SELECT b.bus_number, b.registration_number, b.make, b.model, b.seater, b.status::text, b.odometer_km::text
         FROM buses b
         ${where}
         ORDER BY b.id DESC`,
        params,
      );
      return result.rows;
    }
    case "drivers": {
      const where = buildWhere("d", params, { q, status, from, to, dateColumn: "created_at", searchCols: ["full_name", "phone", "license_number", "company_name"], statusCol: "is_active" });
      const result = await query<ExportRow>(
        `SELECT d.full_name, d.phone, d.company_name, d.license_number, d.is_active::text
         FROM drivers d
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
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(16).text(`${moduleKey.toUpperCase()} Export Report`, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Records: ${rows.length}`);
  doc.moveDown(0.8);
  doc.fontSize(8).text(headers.join(" | "));
  doc.moveDown(0.3);
  doc.moveTo(36, doc.y).lineTo(560, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.5);

  for (const row of rows) {
    const line = headers.map((h) => `${h}: ${row[h] ?? "-"}`).join(" | ");
    doc.fontSize(8).text(line, { width: 520 });
    doc.moveDown(0.3);
    if (doc.y > 760) doc.addPage();
  }

  doc.end();
  const pdf = await done;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${moduleKey}-export.pdf"`,
    },
  });
}
