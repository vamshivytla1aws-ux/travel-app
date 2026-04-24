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

  const lines: string[] = [];
  lines.push(`Bus ID: ${bus.id}`);
  lines.push(`Bus Number: ${bus.bus_number}`);
  lines.push(`Registration: ${bus.registration_number}`);
  lines.push(`Vehicle: ${bus.make} ${bus.model}`);
  lines.push(`Seater: ${bus.seater}`);
  lines.push(`Status: ${bus.status}`);
  lines.push(`Odometer (KM): ${bus.odometer_km}`);
  lines.push("");
  lines.push("Fuel History (Latest 30)");
  if (fuelRes.rows.length === 0) {
    lines.push("No fuel history");
  } else {
    fuelRes.rows.forEach((row, idx) => {
      const liters = Number(row.liters);
      const start = row.odometer_before_km != null ? Number(row.odometer_before_km) : null;
      const end = row.odometer_after_km != null ? Number(row.odometer_after_km) : null;
      const mileage = start != null && end != null && liters > 0 ? ((end - start) / liters).toFixed(2) : "N/A";
      lines.push(
        `${idx + 1}. ${fmtDate(row.filled_at)} | ${row.source} | Start: ${start ?? "-"} | End: ${end ?? "-"} | Liters: ${liters.toFixed(2)} | KM/L: ${mileage} | Company: ${toText(row.company_name)} | Amount: ${Number(row.amount).toFixed(2)}`,
      );
    });
  }
  lines.push("");
  lines.push("Maintenance (Latest 20)");
  if (maintenanceRes.rows.length === 0) {
    lines.push("No maintenance records");
  } else {
    maintenanceRes.rows.forEach((row, idx) => {
      lines.push(
        `${idx + 1}. ${fmtDate(row.maintenance_date)} | ${toText(row.issue_type)} | Cost: ${Number(row.cost).toFixed(2)} | ${toText(row.description)}`,
      );
    });
  }

  return renderTextPdf("Bus Profile Report", lines);
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
    }>(
      `SELECT id, full_name, phone, company_name, license_number, license_expiry::text, experience_years::text, bank_name, bank_account_number, bank_ifsc
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

  const lines: string[] = [];
  lines.push(`Driver Profile Form`);
  lines.push(`Driver ID: ${driver.id}`);
  lines.push("");
  lines.push("Basic");
  lines.push(`Driver Name: ${driver.full_name}`);
  lines.push(`Contact No: ${driver.phone}`);
  lines.push(`Company: ${toText(driver.company_name)}`);
  lines.push("");
  lines.push("Vehicle & License");
  lines.push(`Vehicle Registration: ${toText(profile?.vehicle_registration_no)}`);
  lines.push(`Present Reading: ${toText(profile?.present_reading_km)}`);
  lines.push(`Driving License No: ${driver.license_number}`);
  lines.push(`Validity (DL): ${fmtDate(driver.license_expiry)}`);
  lines.push(`Badge No: ${toText(profile?.badge_no)}`);
  lines.push(`Validity (Badge): ${fmtDate(profile?.badge_validity)}`);
  lines.push("");
  lines.push("Family Details");
  lines.push(`Father's Name: ${toText(profile?.father_name)}`);
  lines.push(`Father Contact: ${toText(profile?.father_contact)}`);
  lines.push(`Mother's Name: ${toText(profile?.mother_name)}`);
  lines.push(`Mother Contact: ${toText(profile?.mother_contact)}`);
  lines.push(`Spouse Name: ${toText(profile?.spouse_name)}`);
  lines.push(`Spouse Contact: ${toText(profile?.spouse_contact)}`);
  lines.push(`Children 1: ${toText(profile?.child_1_name)}`);
  lines.push(`Children 2: ${toText(profile?.child_2_name)}`);
  lines.push("");
  lines.push("Identity & Banking");
  lines.push(`Blood Group: ${toText(profile?.blood_group)}`);
  lines.push(`PAN / Voter ID: ${toText(profile?.pan_or_voter_id)}`);
  lines.push(`Aadhaar No: ${toText(profile?.aadhaar_no)}`);
  lines.push(`Bank Name: ${toText(driver.bank_name)}`);
  lines.push(`Bank Account No: ${toText(driver.bank_account_number)}`);
  lines.push(`IFSC No: ${toText(driver.bank_ifsc)}`);
  lines.push("");
  lines.push("Education & Personal");
  lines.push(`Education: ${toText(profile?.education)}`);
  lines.push(`Experience: ${toText(driver.experience_years)}`);
  lines.push(`Date of Birth: ${fmtDate(profile?.date_of_birth)}`);
  lines.push(`Marital Status: ${toText(profile?.marital_status)}`);
  lines.push(`Religion: ${toText(profile?.religion)}`);
  lines.push("");
  lines.push("Present Address");
  lines.push(
    [
      profile?.present_village,
      profile?.present_landmark,
      profile?.present_post_office,
      profile?.present_mandal,
      profile?.present_police_station,
      profile?.present_district,
      profile?.present_state,
      profile?.present_pin_code,
    ]
      .map(toText)
      .filter((value) => value !== "-")
      .join(", ") || "-",
  );
  lines.push("");
  lines.push("Permanent Address");
  lines.push(
    [
      profile?.permanent_village,
      profile?.permanent_landmark,
      profile?.permanent_post_office,
      profile?.permanent_mandal,
      profile?.permanent_police_station,
      profile?.permanent_district,
      profile?.permanent_state,
      profile?.permanent_pin_code,
    ]
      .map(toText)
      .filter((value) => value !== "-")
      .join(", ") || "-",
  );
  lines.push("");
  lines.push("Reference Details");
  lines.push(
    `Reference 1: ${toText(profile?.reference1_name)} | ${toText(profile?.reference1_relationship)} | ${toText(profile?.reference1_contact)}`,
  );
  lines.push(
    `Reference 2: ${toText(profile?.reference2_name)} | ${toText(profile?.reference2_relationship)} | ${toText(profile?.reference2_contact)}`,
  );
  lines.push("");
  lines.push("Salary Details");
  lines.push(`Present Salary: ${toText(profile?.present_salary)}`);
  lines.push(`Salary Expectation: ${toText(profile?.salary_expectation)}`);
  lines.push(`Salary Offered: ${toText(profile?.salary_offered)}`);
  lines.push(`Joining Date: ${fmtDate(profile?.joining_date)}`);
  lines.push("");
  lines.push("Final Signatures");
  lines.push(`Candidate Signature / Date: ${toText(profile?.candidate_signature_text)} | ${fmtDate(profile?.candidate_signature_date)}`);
  lines.push(`Signature of Appointee: ${toText(profile?.appointee_signature_text)}`);
  lines.push(`Signature of Approval Authority: ${toText(profile?.approval_authority_signature_text)}`);

  lines.push("");
  lines.push("Extended Intake (Raw)");
  if (!profile) {
    lines.push("No extended profile saved");
  } else {
    lines.push(`Profile Fields Loaded: Yes`);
  }

  return renderTextPdf("Driver Profile Report", lines);
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
