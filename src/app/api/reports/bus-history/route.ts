import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { appDateFromTimestamptzSql, formatDateInAppTimeZone, formatDateTimeInAppTimeZone } from "@/lib/timezone";

type ExportRow = {
  bus_number: string;
  registration_number: string;
  filled_at: string;
  odometer_before_km: string;
  odometer_after_km: string;
  liters: string;
  company_name: string | null;
};

function formatDate(value: string) {
  return formatDateInAppTimeZone(value);
}

export async function GET(request: Request) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const busId = url.searchParams.get("busId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const mode = url.searchParams.get("mode") ?? "latest";
  const fields = url.searchParams.getAll("field");

  const selectedFields =
    fields.length > 0
      ? fields
      : ["mileage", "fuel_filled", "kms_run", "odometer_start", "odometer_end", "company_name"];

  const params: unknown[] = [];
  const where: string[] = [];

  if (busId && busId !== "all") {
    params.push(Number(busId));
    where.push(`f.bus_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`${appDateFromTimestamptzSql("f.filled_at")} >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`${appDateFromTimestamptzSql("f.filled_at")} <= $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql =
    mode === "latest"
      ? `
      SELECT DISTINCT ON (f.bus_id)
        b.bus_number, b.registration_number, f.filled_at::text, f.odometer_before_km::text, f.odometer_after_km::text,
        f.liters::text, f.company_name
      FROM fuel_entries f
      JOIN buses b ON b.id = f.bus_id
      ${whereClause}
      ORDER BY f.bus_id, f.filled_at DESC
    `
      : `
      SELECT
        b.bus_number, b.registration_number, f.filled_at::text, f.odometer_before_km::text, f.odometer_after_km::text,
        f.liters::text, f.company_name
      FROM fuel_entries f
      JOIN buses b ON b.id = f.bus_id
      ${whereClause}
      ORDER BY f.filled_at DESC
    `;

  const result = await query<ExportRow>(sql, params);
  const pdfDoc = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 30;
  const lineHeight = 12;
  const maxLineChars = 170;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number] }) => {
    const size = options?.size ?? 8;
    if (y - lineHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: options?.bold ? boldFont : bodyFont,
      color: rgb(...(options?.color ?? [0, 0, 0])),
    });
    y -= lineHeight;
  };

  drawLine("Bus Fuel and Mileage Report", { size: 14, bold: true });
  drawLine(`Generated: ${formatDateTimeInAppTimeZone(new Date())}`, { color: [0.25, 0.25, 0.25] });
  drawLine(`Mode: ${mode === "latest" ? "Latest entry per bus" : "History by date range"}`, {
    color: [0.25, 0.25, 0.25],
  });
  drawLine(`Records: ${result.rows.length}`, { color: [0.25, 0.25, 0.25] });
  drawLine("");

  const headerSegments = ["S.No", "Bus", "Registration", "Date"];
  if (selectedFields.includes("odometer_start")) headerSegments.push("Odo Start");
  if (selectedFields.includes("odometer_end")) headerSegments.push("Odo End");
  if (selectedFields.includes("kms_run")) headerSegments.push("KM Run");
  if (selectedFields.includes("fuel_filled")) headerSegments.push("Litres");
  if (selectedFields.includes("mileage")) headerSegments.push("KM/L");
  if (selectedFields.includes("company_name")) headerSegments.push("Company");
  drawLine(headerSegments.join(" | "), { bold: true });

  result.rows.forEach((row, index) => {
    const odoStart = Number(row.odometer_before_km);
    const odoEnd = Number(row.odometer_after_km);
    const liters = Number(row.liters);
    const safeOdoStart = Number.isFinite(odoStart) ? odoStart : 0;
    const safeOdoEnd = Number.isFinite(odoEnd) ? odoEnd : 0;
    const safeLiters = Number.isFinite(liters) ? liters : 0;
    const kmRun = safeOdoEnd - safeOdoStart;
    const mileage = safeLiters > 0 ? kmRun / safeLiters : 0;

    const segments = [
      String(index + 1),
      row.bus_number,
      row.registration_number,
      formatDate(row.filled_at),
    ];
    if (selectedFields.includes("odometer_start")) segments.push(safeOdoStart.toFixed(1));
    if (selectedFields.includes("odometer_end")) segments.push(safeOdoEnd.toFixed(1));
    if (selectedFields.includes("kms_run")) segments.push(kmRun.toFixed(1));
    if (selectedFields.includes("fuel_filled")) segments.push(safeLiters.toFixed(2));
    if (selectedFields.includes("mileage")) segments.push(mileage.toFixed(2));
    if (selectedFields.includes("company_name")) segments.push(row.company_name ?? "-");

    const line = segments.join(" | ");
    if (line.length <= maxLineChars) {
      drawLine(line);
      return;
    }
    for (let i = 0; i < line.length; i += maxLineChars) {
      drawLine(line.slice(i, i + maxLineChars));
    }
  });

  const binary = await pdfDoc.save();
  return new Response(Buffer.from(binary), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bus-history-report.pdf"`,
    },
  });
}
