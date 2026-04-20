import PDFDocument from "pdfkit";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";

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
  return new Date(value).toLocaleDateString();
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
    where.push(`DATE(f.filled_at) >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`DATE(f.filled_at) <= $${params.length}`);
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

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).text("Bus Fuel and Mileage Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Mode: ${mode === "latest" ? "Latest entry per bus" : "History by date range"}`);
  doc.text(`Records: ${result.rows.length}`);
  doc.moveDown(0.8);

  doc.fontSize(9).text("S.No", 40, doc.y, { width: 30 });
  doc.text("Bus", 70, doc.y - 10, { width: 80 });
  doc.text("Date", 150, doc.y - 10, { width: 70 });

  let x = 220;
  if (selectedFields.includes("odometer_start")) {
    doc.text("Odo Start", x, doc.y - 10, { width: 55 });
    x += 55;
  }
  if (selectedFields.includes("odometer_end")) {
    doc.text("Odo End", x, doc.y - 10, { width: 55 });
    x += 55;
  }
  if (selectedFields.includes("kms_run")) {
    doc.text("KM Run", x, doc.y - 10, { width: 45 });
    x += 45;
  }
  if (selectedFields.includes("fuel_filled")) {
    doc.text("Litres", x, doc.y - 10, { width: 45 });
    x += 45;
  }
  if (selectedFields.includes("mileage")) {
    doc.text("KM/L", x, doc.y - 10, { width: 40 });
    x += 40;
  }
  if (selectedFields.includes("company_name")) {
    doc.text("Company", x, doc.y - 10, { width: 70 });
  }

  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.3);

  result.rows.forEach((row, index) => {
    const y = doc.y;
    const odoStart = Number(row.odometer_before_km);
    const odoEnd = Number(row.odometer_after_km);
    const liters = Number(row.liters);
    const kmRun = odoEnd - odoStart;
    const mileage = liters > 0 ? kmRun / liters : 0;

    doc.fontSize(8).fillColor("#111111");
    doc.text(String(index + 1), 40, y, { width: 30 });
    doc.text(row.bus_number, 70, y, { width: 80 });
    doc.text(formatDate(row.filled_at), 150, y, { width: 70 });

    let colX = 220;
    if (selectedFields.includes("odometer_start")) {
      doc.text(odoStart.toFixed(1), colX, y, { width: 55 });
      colX += 55;
    }
    if (selectedFields.includes("odometer_end")) {
      doc.text(odoEnd.toFixed(1), colX, y, { width: 55 });
      colX += 55;
    }
    if (selectedFields.includes("kms_run")) {
      doc.text(kmRun.toFixed(1), colX, y, { width: 45 });
      colX += 45;
    }
    if (selectedFields.includes("fuel_filled")) {
      doc.text(liters.toFixed(1), colX, y, { width: 45 });
      colX += 45;
    }
    if (selectedFields.includes("mileage")) {
      doc.text(mileage.toFixed(2), colX, y, { width: 40 });
      colX += 40;
    }
    if (selectedFields.includes("company_name")) {
      doc.text(row.company_name ?? "-", colX, y, { width: 70 });
    }

    doc.moveDown(0.8);
    if (doc.y > 760) {
      doc.addPage();
    }
  });

  doc.end();
  const pdfBuffer = await done;
  const binary = new Uint8Array(pdfBuffer);

  return new Response(binary, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bus-history-report.pdf"`,
    },
  });
}
