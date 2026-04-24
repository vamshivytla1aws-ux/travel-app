import PDFDocument from "pdfkit";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function addSectionTitle(doc: any, title: string) {
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title);
  doc.moveDown(0.1);
}

function addField(doc: any, label: string, value: unknown) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value == null || value === "" ? "-" : String(value));
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

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(16).text("Bus Profile Report", { align: "center" });
  doc.moveDown(0.4);
  addField(doc, "Generated", new Date().toLocaleString());
  addField(doc, "Bus ID", bus.id);

  addSectionTitle(doc, "Bus Information");
  addField(doc, "Bus Number", bus.bus_number);
  addField(doc, "Registration", bus.registration_number);
  addField(doc, "Vehicle", `${bus.make} ${bus.model}`);
  addField(doc, "Seater", bus.seater);
  addField(doc, "Status", bus.status);
  addField(doc, "Odometer (KM)", bus.odometer_km);

  addSectionTitle(doc, "Fuel History (Latest 30)");
  if (fuelRes.rows.length === 0) {
    addField(doc, "Records", "No fuel history");
  } else {
    fuelRes.rows.forEach((row, idx) => {
      const liters = Number(row.liters);
      const start = row.odometer_before_km != null ? Number(row.odometer_before_km) : null;
      const end = row.odometer_after_km != null ? Number(row.odometer_after_km) : null;
      const mileage = start != null && end != null && liters > 0 ? ((end - start) / liters).toFixed(2) : "N/A";
      addField(
        doc,
        `#${idx + 1}`,
        `${fmtDate(row.filled_at)} | ${row.source} | Start: ${start ?? "-"} | End: ${end ?? "-"} | Liters: ${liters.toFixed(2)} | KM/L: ${mileage} | Company: ${row.company_name ?? "-"} | Amount: ${Number(row.amount).toFixed(2)}`,
      );
      if (doc.y > 780) doc.addPage();
    });
  }

  addSectionTitle(doc, "Maintenance (Latest 20)");
  if (maintenanceRes.rows.length === 0) {
    addField(doc, "Records", "No maintenance records");
  } else {
    maintenanceRes.rows.forEach((row, idx) => {
      addField(
        doc,
        `#${idx + 1}`,
        `${fmtDate(row.maintenance_date)} | ${row.issue_type} | Cost: ${Number(row.cost).toFixed(2)} | ${row.description}`,
      );
      if (doc.y > 780) doc.addPage();
    });
  }

  doc.end();
  return done;
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
    query<{
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
    }>(
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
    ),
  ]);

  const driver = driverRes.rows[0];
  if (!driver) return null;
  const profile = profileRes.rows[0];

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(16).text("Driver Profile Report", { align: "center" });
  doc.moveDown(0.4);
  addField(doc, "Generated", new Date().toLocaleString());
  addField(doc, "Driver ID", driver.id);

  addSectionTitle(doc, "Driver Information");
  addField(doc, "Driver Name", driver.full_name);
  addField(doc, "Contact No", driver.phone);
  addField(doc, "Company", driver.company_name ?? "-");
  addField(doc, "Driving License No", driver.license_number);
  addField(doc, "Validity (DL)", fmtDate(driver.license_expiry));
  addField(doc, "Experience", driver.experience_years ?? "-");
  addField(doc, "Bank", `${driver.bank_name ?? "-"} | A/C: ${driver.bank_account_number ?? "-"} | IFSC: ${driver.bank_ifsc ?? "-"}`);

  addSectionTitle(doc, "Extended Intake");
  if (!profile) {
    addField(doc, "Profile", "No extended profile saved");
  } else {
    addField(doc, "Blood Group", profile.blood_group);
    addField(doc, "Father", `${profile.father_name ?? "-"} (${profile.father_contact ?? "-"})`);
    addField(doc, "Mother", `${profile.mother_name ?? "-"} (${profile.mother_contact ?? "-"})`);
    addField(doc, "Spouse", `${profile.spouse_name ?? "-"} (${profile.spouse_contact ?? "-"})`);
    addField(doc, "Children", `${profile.child_1_name ?? "-"}, ${profile.child_2_name ?? "-"}`);
    addField(doc, "PAN / Voter", profile.pan_or_voter_id);
    addField(doc, "Aadhaar", profile.aadhaar_no);
    addField(doc, "Vehicle", profile.vehicle_registration_no);
    addField(doc, "Present Reading", profile.present_reading_km ?? "-");
    addField(doc, "Badge", `${profile.badge_no ?? "-"} | Validity: ${fmtDate(profile.badge_validity)}`);
    addField(doc, "Education", profile.education);
    addField(doc, "DOB", fmtDate(profile.date_of_birth));
    addField(doc, "Marital Status", profile.marital_status);
    addField(doc, "Religion", profile.religion);
    addField(
      doc,
      "Present Address",
      [
        profile.present_village,
        profile.present_landmark,
        profile.present_post_office,
        profile.present_mandal,
        profile.present_police_station,
        profile.present_district,
        profile.present_state,
        profile.present_pin_code,
      ]
        .filter(Boolean)
        .join(", "),
    );
    addField(
      doc,
      "Permanent Address",
      [
        profile.permanent_village,
        profile.permanent_landmark,
        profile.permanent_post_office,
        profile.permanent_mandal,
        profile.permanent_police_station,
        profile.permanent_district,
        profile.permanent_state,
        profile.permanent_pin_code,
      ]
        .filter(Boolean)
        .join(", "),
    );
    addField(doc, "Reference 1", `${profile.reference1_name ?? "-"} | ${profile.reference1_relationship ?? "-"} | ${profile.reference1_contact ?? "-"}`);
    addField(doc, "Reference 2", `${profile.reference2_name ?? "-"} | ${profile.reference2_relationship ?? "-"} | ${profile.reference2_contact ?? "-"}`);
    addField(doc, "Salary", `Present: ${profile.present_salary ?? "-"} | Expected: ${profile.salary_expectation ?? "-"} | Offered: ${profile.salary_offered ?? "-"}`);
    addField(doc, "Joining Date", fmtDate(profile.joining_date));
    addField(doc, "Candidate Signature / Date", `${profile.candidate_signature_text ?? "-"} | ${fmtDate(profile.candidate_signature_date)}`);
    addField(doc, "Appointee Signature", profile.appointee_signature_text);
    addField(doc, "Approval Authority", profile.approval_authority_signature_text);
  }

  doc.end();
  return done;
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
    const pdf = await buildBusProfilePdf(id);
    if (!pdf) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bus-profile-${id}.pdf"`,
      },
    });
  }

  if (type === "driver") {
    const session = await requireApiModuleAccess("drivers");
    if (!session) return new Response("Forbidden", { status: 403 });
    const pdf = await buildDriverProfilePdf(id);
    if (!pdf) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="driver-profile-${id}.pdf"`,
      },
    });
  }

  return new Response("Invalid type", { status: 400 });
}
