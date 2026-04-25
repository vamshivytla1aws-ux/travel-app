import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import {
  formatDateInAppTimeZone,
  formatDateTimeInAppTimeZone,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DriverProfileRow = {
  blood_group: string | null;
  father_name: string | null;
  father_contact: string | null;
  mother_name: string | null;
  mother_contact: string | null;
  spouse_name: string | null;
  spouse_contact: string | null;
  child_1_name: string | null;
  child_2_name: string | null;
  pan_or_voter_id: string | null;
  aadhaar_no: string | null;
  vehicle_registration_no: string | null;
  present_reading_km: string | null;
  badge_no: string | null;
  badge_validity: string | null;
  education: string | null;
  date_of_birth: string | null;
  marital_status: string | null;
  religion: string | null;
  present_village: string | null;
  present_landmark: string | null;
  present_post_office: string | null;
  present_mandal: string | null;
  present_police_station: string | null;
  present_district: string | null;
  present_state: string | null;
  present_pin_code: string | null;
  permanent_village: string | null;
  permanent_landmark: string | null;
  permanent_post_office: string | null;
  permanent_mandal: string | null;
  permanent_police_station: string | null;
  permanent_district: string | null;
  permanent_state: string | null;
  permanent_pin_code: string | null;
  reference1_name: string | null;
  reference1_relationship: string | null;
  reference1_contact: string | null;
  reference2_name: string | null;
  reference2_relationship: string | null;
  reference2_contact: string | null;
  present_salary: string | null;
  salary_expectation: string | null;
  salary_offered: string | null;
  joining_date: string | null;
  candidate_signature_text: string | null;
  candidate_signature_date: string | null;
  appointee_signature_text: string | null;
  approval_authority_signature_text: string | null;
};

async function tryEnsureTransportEnhancements() {
  try {
    await ensureTransportEnhancements();
  } catch (error) {
    console.warn("Skipping schema ensure in profile export route", error);
  }
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDateInAppTimeZone(parsed);
}

function toText(value: unknown) {
  if (value == null) return "-";
  const text = String(value).trim();
  return text.length > 0 ? text : "-";
}

async function renderTextPdf(title: string, lines: string[]) {
  const pdfDoc = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const lineHeight = 12;
  const maxLineChars = 128;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (
    text: string,
    options?: { size?: number; bold?: boolean; color?: [number, number, number] },
  ) => {
    const size = options?.size ?? 9;
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

  drawLine(title, { size: 16, bold: true });
  drawLine(`Generated: ${formatDateTimeInAppTimeZone(new Date())}`, {
    size: 9,
    color: [0.25, 0.25, 0.25],
  });
  drawLine("");

  lines.forEach((line) => {
    if (line.length <= maxLineChars) {
      drawLine(line);
      return;
    }
    for (let i = 0; i < line.length; i += maxLineChars) {
      drawLine(line.slice(i, i + maxLineChars));
    }
  });

  return Buffer.from(await pdfDoc.save());
}

async function buildBusProfilePdf(busId: number) {
  const [busRes, fuelRes, maintenanceRes] = await Promise.all([
    query<{
      id: number;
      bus_number: string;
      registration_number: string;
      make: string;
      model: string;
      seater: string;
      status: string;
      odometer_km: string;
    }>(
      `SELECT id, bus_number, registration_number, make, model, seater::text, status::text, odometer_km::text
       FROM buses WHERE id = $1`,
      [busId],
    ),
    query<{
      source: "TANKER" | "MANUAL";
      filled_at: string;
      odometer_before_km: string | null;
      odometer_after_km: string | null;
      liters: string;
      amount: string;
      company_name: string | null;
    }>(
      `SELECT *
       FROM (
         SELECT
           'MANUAL'::text AS source,
           fe.filled_at::text,
           fe.odometer_before_km::text,
           fe.odometer_after_km::text,
           fe.liters::text,
           fe.amount::text,
           fe.company_name
         FROM fuel_entries fe
         WHERE fe.bus_id = $1
         UNION ALL
         SELECT
           'TANKER'::text AS source,
           (fi.issue_date::text || 'T' || fi.issue_time::text)::text AS filled_at,
           fi.odometer_before_km::text,
           fi.odometer_after_km::text,
           fi.liters_issued::text AS liters,
           fi.amount::text,
           fi.company_name
         FROM fuel_issues fi
         WHERE fi.bus_id = $1
       ) x
       ORDER BY filled_at DESC
       LIMIT 30`,
      [busId],
    ),
    query<{ maintenance_date: string; issue_type: string; description: string; cost: string }>(
      `SELECT maintenance_date::text, issue_type, description, cost::text
       FROM maintenance_records
       WHERE bus_id = $1
       ORDER BY maintenance_date DESC
       LIMIT 20`,
      [busId],
    ),
  ]);

  const bus = busRes.rows[0];
  if (!bus) return null;
  const pdfDoc = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const sectionHeaderHeight = 18;
  const tableHeaderHeight = 18;
  const rowHeight = 16;
  const keyValueRowHeight = 18;
  const generatedAt = formatDateTimeInAppTimeZone(new Date());

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page.drawText("JAI BHAVANI TRAVELS", {
        x: margin,
        y: y - 2,
        size: 10,
        font: boldFont,
        color: rgb(0.14, 0.2, 0.34),
      });
      y -= 14;
    }
  };

  const clipText = (text: string, maxWidth: number, size = 8, bold = false) => {
    const font = bold ? boldFont : bodyFont;
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let next = text;
    while (next.length > 0 && font.widthOfTextAtSize(`${next}...`, size) > maxWidth) {
      next = next.slice(0, -1);
    }
    return next.length ? `${next}...` : "";
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(sectionHeaderHeight + 4);
    page.drawRectangle({
      x: margin,
      y: y - sectionHeaderHeight,
      width: contentWidth,
      height: sectionHeaderHeight,
      color: rgb(0.92, 0.95, 1),
      borderColor: rgb(0.72, 0.79, 0.95),
      borderWidth: 1,
    });
    page.drawText(title, {
      x: margin + 6,
      y: y - sectionHeaderHeight + 5,
      size: 10,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.45),
    });
    y -= sectionHeaderHeight + 4;
  };

  const drawTableHeader = (headers: string[], widths: number[]) => {
    ensureSpace(tableHeaderHeight);
    let x = margin;
    headers.forEach((header, idx) => {
      page.drawRectangle({
        x,
        y: y - tableHeaderHeight,
        width: widths[idx],
        height: tableHeaderHeight,
        color: rgb(0.95, 0.97, 1),
        borderColor: rgb(0.72, 0.79, 0.95),
        borderWidth: 0.5,
      });
      page.drawText(clipText(header, widths[idx] - 6, 7, true), {
        x: x + 3,
        y: y - tableHeaderHeight + 6,
        size: 7,
        font: boldFont,
        color: rgb(0.12, 0.2, 0.35),
      });
      x += widths[idx];
    });
    y -= tableHeaderHeight;
  };

  const drawTableRow = (values: string[], widths: number[]) => {
    ensureSpace(rowHeight);
    let x = margin;
    values.forEach((value, idx) => {
      page.drawRectangle({
        x,
        y: y - rowHeight,
        width: widths[idx],
        height: rowHeight,
        borderColor: rgb(0.82, 0.86, 0.92),
        borderWidth: 0.35,
      });
      page.drawText(clipText(value, widths[idx] - 6, 7), {
        x: x + 3,
        y: y - rowHeight + 5,
        size: 7,
        font: bodyFont,
        color: rgb(0.1, 0.1, 0.12),
      });
      x += widths[idx];
    });
    y -= rowHeight;
  };

  page.drawText("Bio - Data", {
    x: margin,
    y: y - 2,
    size: 14,
    font: boldFont,
    color: rgb(0.25, 0.28, 0.34),
  });
  page.drawText("JAI BHAVANI TRAVELS", {
    x: margin,
    y: y - 26,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.12, 0.18),
  });
  page.drawText("Bus Profile Report", {
    x: margin,
    y: y - 44,
    size: 11,
    font: boldFont,
    color: rgb(0.14, 0.2, 0.34),
  });
  page.drawText(`Generated: ${generatedAt}`, {
    x: margin,
    y: y - 58,
    size: 9,
    font: bodyFont,
    color: rgb(0.3, 0.34, 0.4),
  });
  y -= 72;

  drawSectionHeader("Bus Overview");
  const keyValues: Array<{ label: string; value: string }> = [
    { label: "Bus ID", value: String(bus.id) },
    { label: "Bus Number", value: bus.bus_number },
    { label: "Registration", value: bus.registration_number },
    { label: "Make", value: bus.make },
    { label: "Model", value: bus.model },
    { label: "Seater", value: bus.seater },
    { label: "Status", value: bus.status },
    { label: "Odometer (KM)", value: bus.odometer_km },
  ];
  const kvColWidth = (contentWidth - 10) / 2;
  for (let i = 0; i < keyValues.length; i += 2) {
    ensureSpace(keyValueRowHeight);
    [0, 1].forEach((slot) => {
      const item = keyValues[i + slot];
      if (!item) return;
      const x = margin + slot * (kvColWidth + 10);
      page.drawRectangle({
        x,
        y: y - keyValueRowHeight,
        width: kvColWidth,
        height: keyValueRowHeight,
        borderColor: rgb(0.82, 0.86, 0.92),
        borderWidth: 0.45,
      });
      const text = `${item.label}: ${item.value}`;
      page.drawText(clipText(text, kvColWidth - 8, 8, slot === 0), {
        x: x + 4,
        y: y - keyValueRowHeight + 5,
        size: 8,
        font: bodyFont,
        color: rgb(0.1, 0.12, 0.16),
      });
    });
    y -= keyValueRowHeight;
  }

  drawSectionHeader(`Fuel History (${fuelRes.rows.length})`);
  if (fuelRes.rows.length === 0) {
    ensureSpace(16);
    page.drawText("No fuel history records available.", {
      x: margin + 4,
      y: y - 10,
      size: 9,
      font: bodyFont,
      color: rgb(0.45, 0.48, 0.55),
    });
    y -= 16;
  } else {
    const fuelHeaders = ["Date", "Source", "Start", "End", "Liters", "KM/L", "Company", "Amount"];
    const fuelWidths = [62, 48, 50, 50, 46, 42, 133, 52];
    drawTableHeader(fuelHeaders, fuelWidths);
    fuelRes.rows.forEach((row) => {
      const liters = Number(row.liters);
      const start = row.odometer_before_km != null ? Number(row.odometer_before_km) : null;
      const end = row.odometer_after_km != null ? Number(row.odometer_after_km) : null;
      const mileage = start != null && end != null && liters > 0 ? ((end - start) / liters).toFixed(2) : "N/A";
      drawTableRow(
        [
          fmtDate(row.filled_at),
          row.source,
          start != null ? start.toFixed(2) : "-",
          end != null ? end.toFixed(2) : "-",
          liters.toFixed(2),
          mileage,
          toText(row.company_name),
          Number(row.amount).toFixed(2),
        ],
        fuelWidths,
      );
      if (y - rowHeight < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawSectionHeader("Fuel History (continued)");
        drawTableHeader(fuelHeaders, fuelWidths);
      }
    });
  }

  drawSectionHeader(`Maintenance History (${maintenanceRes.rows.length})`);
  if (maintenanceRes.rows.length === 0) {
    ensureSpace(16);
    page.drawText("No maintenance records available.", {
      x: margin + 4,
      y: y - 10,
      size: 9,
      font: bodyFont,
      color: rgb(0.45, 0.48, 0.55),
    });
    y -= 16;
  } else {
    const maintenanceHeaders = ["Date", "Issue", "Description", "Cost"];
    const maintenanceWidths = [80, 110, 260, 73];
    drawTableHeader(maintenanceHeaders, maintenanceWidths);
    maintenanceRes.rows.forEach((row) => {
      drawTableRow(
        [
          fmtDate(row.maintenance_date),
          toText(row.issue_type),
          toText(row.description),
          Number(row.cost).toFixed(2),
        ],
        maintenanceWidths,
      );
      if (y - rowHeight < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawSectionHeader("Maintenance History (continued)");
        drawTableHeader(maintenanceHeaders, maintenanceWidths);
      }
    });
  }

  return Buffer.from(await pdfDoc.save());
}

async function buildDriverProfilePdf(driverId: number) {
  const [driverRes, profileRes] = await Promise.all([
    query<{
      id: number;
      full_name: string;
      phone: string;
      company_name: string | null;
      license_number: string;
      license_expiry: string | null;
      experience_years: string | null;
      bank_name: string | null;
      bank_account_number: string | null;
      bank_ifsc: string | null;
      pf_account_number: string | null;
      uan_number: string | null;
      esic_number: string | null;
      profile_photo_data: Buffer | null;
      profile_photo_mime: string | null;
    }>(
      `SELECT id, full_name, phone, company_name, license_number, license_expiry::text, experience_years::text, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number, esic_number, profile_photo_data, profile_photo_mime
       FROM drivers WHERE id = $1`,
      [driverId],
    ),
    query<DriverProfileRow>(
      `SELECT
         blood_group, father_name, father_contact, mother_name, mother_contact, spouse_name, spouse_contact,
         child_1_name, child_2_name, pan_or_voter_id, aadhaar_no, vehicle_registration_no, present_reading_km::text,
         badge_no, badge_validity::text, education, date_of_birth::text, marital_status, religion,
         present_village, present_landmark, present_post_office, present_mandal, present_police_station, present_district,
         present_state, present_pin_code, permanent_village, permanent_landmark, permanent_post_office, permanent_mandal,
         permanent_police_station, permanent_district, permanent_state, permanent_pin_code,
         reference1_name, reference1_relationship, reference1_contact, reference2_name, reference2_relationship, reference2_contact,
         present_salary::text, salary_expectation::text, salary_offered::text, joining_date::text,
         candidate_signature_text, candidate_signature_date::text, appointee_signature_text, approval_authority_signature_text
      FROM driver_profiles
      WHERE driver_id = $1`,
      [driverId],
    ).catch(async () => {
      const minimal = await query<DriverProfileRow>(
        `SELECT NULL::text AS blood_group,
                NULL::text AS father_name,
                NULL::text AS father_contact,
                NULL::text AS mother_name,
                NULL::text AS mother_contact,
                NULL::text AS spouse_name,
                NULL::text AS spouse_contact,
                NULL::text AS child_1_name,
                NULL::text AS child_2_name,
                NULL::text AS pan_or_voter_id,
                NULL::text AS aadhaar_no,
                NULL::text AS vehicle_registration_no,
                NULL::text AS present_reading_km,
                NULL::text AS badge_no,
                NULL::text AS badge_validity,
                NULL::text AS education,
                NULL::text AS date_of_birth,
                NULL::text AS marital_status,
                NULL::text AS religion,
                NULL::text AS present_village,
                NULL::text AS present_landmark,
                NULL::text AS present_post_office,
                NULL::text AS present_mandal,
                NULL::text AS present_police_station,
                NULL::text AS present_district,
                NULL::text AS present_state,
                NULL::text AS present_pin_code,
                NULL::text AS permanent_village,
                NULL::text AS permanent_landmark,
                NULL::text AS permanent_post_office,
                NULL::text AS permanent_mandal,
                NULL::text AS permanent_police_station,
                NULL::text AS permanent_district,
                NULL::text AS permanent_state,
                NULL::text AS permanent_pin_code,
                NULL::text AS reference1_name,
                NULL::text AS reference1_relationship,
                NULL::text AS reference1_contact,
                NULL::text AS reference2_name,
                NULL::text AS reference2_relationship,
                NULL::text AS reference2_contact,
                NULL::text AS present_salary,
                NULL::text AS salary_expectation,
                NULL::text AS salary_offered,
                NULL::text AS joining_date,
                NULL::text AS candidate_signature_text,
                NULL::text AS candidate_signature_date,
                NULL::text AS appointee_signature_text,
                NULL::text AS approval_authority_signature_text`,
      );
      return { rows: minimal.rows };
    }),
  ]);

  const driver = driverRes.rows[0];
  if (!driver) return null;
  const profile = profileRes.rows[0];
  const pdfDoc = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 20;
  const sectionHeaderHeight = 12;
  const rowHeight = 16;
  const labelSize = 6;
  const valueSize = 7;
  const sectionGap = 2;
  const colGap = 8;
  const contentWidth = pageWidth - margin * 2;
  const colWidth = (contentWidth - colGap * 2) / 3;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const fitText = (text: string, maxChars = 22) => {
    const safe = toText(text);
    if (safe.length <= maxChars) return safe;
    return `${safe.slice(0, maxChars - 3)}...`;
  };

  const addPageIfNeeded = (neededHeight: number) => {
    if (y - neededHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawSection = (title: string) => {
    addPageIfNeeded(sectionHeaderHeight + 4);
    page.drawRectangle({
      x: margin,
      y: y - sectionHeaderHeight + 2,
      width: contentWidth,
      height: sectionHeaderHeight,
      color: rgb(0.92, 0.95, 1),
      borderColor: rgb(0.72, 0.79, 0.95),
      borderWidth: 1,
    });
    page.drawText(title, {
      x: margin + 6,
      y: y - sectionHeaderHeight + 4,
      size: 8,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.45),
    });
    y -= sectionHeaderHeight + sectionGap;
  };

  const drawRow = (fields: Array<{ label: string; value: string }>) => {
    addPageIfNeeded(rowHeight + 2);
    for (let i = 0; i < 3; i += 1) {
      const field = fields[i];
      const x = margin + i * (colWidth + colGap);
      if (!field) {
        page.drawLine({
          start: { x, y: y - 13 },
          end: { x: x + colWidth, y: y - 13 },
          thickness: 0.6,
          color: rgb(0.8, 0.82, 0.86),
        });
        continue;
      }
      page.drawText(field.label, {
        x,
        y: y - 7,
        size: labelSize,
        font: boldFont,
        color: rgb(0.32, 0.36, 0.44),
      });
      page.drawText(fitText(field.value), {
        x,
        y: y - 11,
        size: valueSize,
        font: bodyFont,
        color: rgb(0.08, 0.09, 0.11),
      });
      page.drawLine({
        start: { x, y: y - 13 },
        end: { x: x + colWidth, y: y - 13 },
        thickness: 0.6,
        color: rgb(0.7, 0.74, 0.82),
      });
    }
    y -= rowHeight;
  };

  const photoWidth = 88;
  const photoHeight = 102;
  const photoX = pageWidth - margin - photoWidth;
  const photoY = pageHeight - margin - photoHeight;
  const headerLeftWidth = photoX - margin - 10;
  const drawCentered = (
    text: string,
    yPos: number,
    size: number,
    font: typeof bodyFont,
    color: [number, number, number],
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = margin + Math.max(0, (headerLeftWidth - textWidth) / 2);
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font,
      color: rgb(...color),
    });
  };

  drawCentered("Bio - Data", pageHeight - margin - 2, 11, boldFont, [0.25, 0.28, 0.34]);
  drawCentered("JAI BHAVANI TRAVELS", pageHeight - margin - 18, 18, boldFont, [0.1, 0.12, 0.18]);
  drawCentered(
    "H.No: 11-22 Srinivasanagar, Ramachandrapuram, Sangareddy Dist",
    pageHeight - margin - 32,
    7,
    bodyFont,
    [0.2, 0.22, 0.27],
  );
  drawCentered("Contact no: 9666227227, 9494665519", pageHeight - margin - 42, 8, boldFont, [0.2, 0.22, 0.27]);

  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoWidth,
    height: photoHeight,
    borderColor: rgb(0.55, 0.61, 0.73),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  });
  page.drawText("Profile Photo", {
    x: photoX + 16,
    y: photoY + photoHeight - 9,
    size: 6,
    font: boldFont,
    color: rgb(0.35, 0.4, 0.5),
  });

  if (driver.profile_photo_data && driver.profile_photo_data.length > 0) {
    try {
      let embeddedImage;
      const mime = (driver.profile_photo_mime ?? "").toLowerCase();
      if (mime.includes("png")) {
        embeddedImage = await pdfDoc.embedPng(driver.profile_photo_data);
      } else {
        try {
          embeddedImage = await pdfDoc.embedJpg(driver.profile_photo_data);
        } catch {
          embeddedImage = await pdfDoc.embedPng(driver.profile_photo_data);
        }
      }
      const scale = Math.min(
        (photoWidth - 8) / embeddedImage.width,
        (photoHeight - 14) / embeddedImage.height,
      );
      const imageWidth = embeddedImage.width * scale;
      const imageHeight = embeddedImage.height * scale;
      page.drawImage(embeddedImage, {
        x: photoX + (photoWidth - imageWidth) / 2,
        y: photoY + 2 + (photoHeight - 14 - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
      });
    } catch {
      page.drawText("Photo format", {
        x: photoX + 24,
        y: photoY + photoHeight / 2,
        size: 8,
        font: bodyFont,
        color: rgb(0.55, 0.2, 0.2),
      });
      page.drawText("not previewable", {
        x: photoX + 18,
        y: photoY + photoHeight / 2 - 10,
        size: 8,
        font: bodyFont,
        color: rgb(0.55, 0.2, 0.2),
      });
    }
  } else {
    page.drawText("No Photo", {
      x: photoX + 27,
      y: photoY + photoHeight / 2,
      size: 7,
      font: bodyFont,
      color: rgb(0.55, 0.58, 0.66),
    });
  }

  y = photoY - 6;

  drawSection("Basic");
  drawRow([
    { label: "Driver Name", value: driver.full_name },
    { label: "Contact No", value: driver.phone },
    { label: "Company", value: toText(driver.company_name) },
  ]);

  drawSection("Vehicle & License");
  drawRow([
    { label: "Vehicle Registration", value: toText(profile?.vehicle_registration_no) },
    { label: "Present Reading", value: toText(profile?.present_reading_km) },
    { label: "Driving License No", value: driver.license_number },
  ]);
  drawRow([
    { label: "Validity (DL)", value: fmtDate(driver.license_expiry) },
    { label: "Badge No", value: toText(profile?.badge_no) },
    { label: "Validity (Badge)", value: fmtDate(profile?.badge_validity) },
  ]);

  drawSection("Family Details");
  drawRow([
    { label: "Father's Name", value: toText(profile?.father_name) },
    { label: "Father Contact", value: toText(profile?.father_contact) },
    { label: "Mother's Name", value: toText(profile?.mother_name) },
  ]);
  drawRow([
    { label: "Mother Contact", value: toText(profile?.mother_contact) },
    { label: "Spouse Name", value: toText(profile?.spouse_name) },
    { label: "Spouse Contact", value: toText(profile?.spouse_contact) },
  ]);
  drawRow([
    { label: "Children 1", value: toText(profile?.child_1_name) },
    { label: "Children 2", value: toText(profile?.child_2_name) },
  ]);

  drawSection("Identity & Banking");
  drawRow([
    { label: "Blood Group", value: toText(profile?.blood_group) },
    { label: "PAN / Voter ID", value: toText(profile?.pan_or_voter_id) },
    { label: "Aadhaar No", value: toText(profile?.aadhaar_no) },
  ]);
  drawRow([
    { label: "Bank Name", value: toText(driver.bank_name) },
    { label: "Bank Account No", value: toText(driver.bank_account_number) },
    { label: "IFSC No", value: toText(driver.bank_ifsc) },
  ]);
  drawRow([
    { label: "PF / EPF Account No", value: toText(driver.pf_account_number) },
    { label: "UAN No", value: toText(driver.uan_number) },
    { label: "ESIC No", value: toText(driver.esic_number) },
  ]);

  drawSection("Education & Personal");
  drawRow([
    { label: "Education", value: toText(profile?.education) },
    { label: "Experience", value: toText(driver.experience_years) },
    { label: "Date of Birth", value: fmtDate(profile?.date_of_birth) },
  ]);
  drawRow([
    { label: "Marital Status", value: toText(profile?.marital_status) },
    { label: "Religion", value: toText(profile?.religion) },
    { label: "Joining Date", value: fmtDate(profile?.joining_date) },
  ]);

  drawSection("Present Address");
  drawRow([
    { label: "Village", value: toText(profile?.present_village) },
    { label: "Land Mark", value: toText(profile?.present_landmark) },
    { label: "Post Office", value: toText(profile?.present_post_office) },
  ]);
  drawRow([
    { label: "Mandal", value: toText(profile?.present_mandal) },
    { label: "Police Station", value: toText(profile?.present_police_station) },
    { label: "District", value: toText(profile?.present_district) },
  ]);
  drawRow([
    { label: "State", value: toText(profile?.present_state) },
    { label: "Pin Code", value: toText(profile?.present_pin_code) },
  ]);

  drawSection("Permanent Address");
  drawRow([
    { label: "Village", value: toText(profile?.permanent_village) },
    { label: "Land Mark", value: toText(profile?.permanent_landmark) },
    { label: "Post Office", value: toText(profile?.permanent_post_office) },
  ]);
  drawRow([
    { label: "Mandal", value: toText(profile?.permanent_mandal) },
    { label: "Police Station", value: toText(profile?.permanent_police_station) },
    { label: "District", value: toText(profile?.permanent_district) },
  ]);
  drawRow([
    { label: "State", value: toText(profile?.permanent_state) },
    { label: "Pin Code", value: toText(profile?.permanent_pin_code) },
  ]);

  drawSection("Reference Details");
  drawRow([
    { label: "Reference 1 Name", value: toText(profile?.reference1_name) },
    { label: "Relation (Ref 1)", value: toText(profile?.reference1_relationship) },
    { label: "Contact (Ref 1)", value: toText(profile?.reference1_contact) },
  ]);
  drawRow([
    { label: "Reference 2 Name", value: toText(profile?.reference2_name) },
    { label: "Relation (Ref 2)", value: toText(profile?.reference2_relationship) },
    { label: "Contact (Ref 2)", value: toText(profile?.reference2_contact) },
  ]);

  drawSection("Salary & Final Signatures");
  drawRow([
    { label: "Present Salary", value: toText(profile?.present_salary) },
    { label: "Salary Expectation", value: toText(profile?.salary_expectation) },
    { label: "Salary Offered", value: toText(profile?.salary_offered) },
  ]);
  drawRow([
    { label: "Candidate Signature / Date", value: `${toText(profile?.candidate_signature_text)} / ${fmtDate(profile?.candidate_signature_date)}` },
    { label: "Signature of Appointee", value: toText(profile?.appointee_signature_text) },
    { label: "Approval Authority", value: toText(profile?.approval_authority_signature_text) },
  ]);

  return Buffer.from(await pdfDoc.save());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") ?? "").toLowerCase();
  const id = Number(url.searchParams.get("id") ?? "0");
  if (!Number.isFinite(id) || id <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  if (type === "bus") {
    const session = await requireApiModuleAccess("buses");
    if (!session) return new Response("Forbidden", { status: 403 });
    try {
      await tryEnsureTransportEnhancements();
      const pdf = await buildBusProfilePdf(id);
      if (!pdf) return new Response("Not found", { status: 404 });
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="bus-profile-${id}.pdf"`,
        },
      });
    } catch (error) {
      console.error("Bus profile export failed", { id, error });
      return new Response("Profile export failed. Please retry in a moment.", { status: 500 });
    }
  }

  if (type === "driver") {
    const session = await requireApiModuleAccess("drivers");
    if (!session) return new Response("Forbidden", { status: 403 });
    try {
      await tryEnsureTransportEnhancements();
      const pdf = await buildDriverProfilePdf(id);
      if (!pdf) return new Response("Not found", { status: 404 });
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="driver-profile-${id}.pdf"`,
        },
      });
    } catch (error) {
      console.error("Driver profile export failed", { id, error });
      return new Response("Profile export failed. Please retry in a moment.", { status: 500 });
    }
  }

  return new Response("Invalid type", { status: 400 });
}
