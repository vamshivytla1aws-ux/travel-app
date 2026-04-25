import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { PoolClient } from "pg";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DriverIntakeDefaults, DriverIntakeForm } from "@/components/drivers/driver-intake-form";
import { FormDirtyGuard } from "@/components/form-dirty-guard";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { DriverProfilePayload, readDriverPayload, validateDriverCore } from "@/lib/driver-payload";
import { getAiScannerEnabled } from "@/lib/app-settings";
import { logAuditEvent } from "@/lib/audit";
import { ensureDocumentTables, getUploadedFileBuffer, isUploadLikeFile } from "@/lib/document-storage";
import { normalizeProfilePhotoMime } from "@/lib/image-mime";
import { query, withTransaction } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();
const MAX_PROFILE_PHOTO_BYTES = 15 * 1024 * 1024;

function sectionRow(label: string, value: string | null | undefined) {
  return (
    <p>
      <span className="font-medium">{label}:</span> {value && value.trim().length > 0 ? value : "-"}
    </p>
  );
}

function toDefaults(profile: Awaited<ReturnType<DriversService["getDriverProfile"]>>): DriverIntakeDefaults {
  if (!profile) {
    throw new Error("Profile missing");
  }
  return {
    fullName: profile.driver.full_name,
    phone: profile.driver.phone,
    companyName: profile.driver.company_name ?? "",
    licenseNumber: profile.driver.license_number,
    licenseExpiry: profile.driver.license_expiry?.slice(0, 10) ?? "",
    experienceYears: String(profile.driver.experience_years ?? 0),
    bankName: profile.driver.bank_name ?? "",
    bankAccountNumber: profile.driver.bank_account_number ?? "",
    bankIfsc: profile.driver.bank_ifsc ?? "",
    pfAccountNumber: profile.driver.pf_account_number ?? "",
    uanNumber: profile.driver.uan_number ?? "",
    esicNumber: profile.driver.esic_number ?? "",
    bloodGroup: profile.profile?.bloodGroup ?? "",
    fatherName: profile.profile?.fatherName ?? "",
    fatherContact: profile.profile?.fatherContact ?? "",
    motherName: profile.profile?.motherName ?? "",
    motherContact: profile.profile?.motherContact ?? "",
    spouseName: profile.profile?.spouseName ?? "",
    spouseContact: profile.profile?.spouseContact ?? "",
    child1Name: profile.profile?.child1Name ?? "",
    child2Name: profile.profile?.child2Name ?? "",
    panOrVoterId: profile.profile?.panOrVoterId ?? "",
    aadhaarNo: profile.profile?.aadhaarNo ?? "",
    vehicleBusId: profile.profile?.vehicleBusId ? String(profile.profile.vehicleBusId) : "",
    vehicleRegistrationNo: profile.profile?.vehicleRegistrationNo ?? "",
    presentReadingKm: profile.profile?.presentReadingKm != null ? String(profile.profile.presentReadingKm) : "",
    badgeNo: profile.profile?.badgeNo ?? "",
    badgeValidity: profile.profile?.badgeValidity?.slice(0, 10) ?? "",
    education: profile.profile?.education ?? "",
    dateOfBirth: profile.profile?.dateOfBirth?.slice(0, 10) ?? "",
    maritalStatus: profile.profile?.maritalStatus ?? "",
    religion: profile.profile?.religion ?? "",
    presentVillage: profile.profile?.presentVillage ?? "",
    presentLandmark: profile.profile?.presentLandmark ?? "",
    presentPostOffice: profile.profile?.presentPostOffice ?? "",
    presentMandal: profile.profile?.presentMandal ?? "",
    presentPoliceStation: profile.profile?.presentPoliceStation ?? "",
    presentDistrict: profile.profile?.presentDistrict ?? "",
    presentState: profile.profile?.presentState ?? "",
    presentPinCode: profile.profile?.presentPinCode ?? "",
    permanentVillage: profile.profile?.permanentVillage ?? "",
    permanentLandmark: profile.profile?.permanentLandmark ?? "",
    permanentPostOffice: profile.profile?.permanentPostOffice ?? "",
    permanentMandal: profile.profile?.permanentMandal ?? "",
    permanentPoliceStation: profile.profile?.permanentPoliceStation ?? "",
    permanentDistrict: profile.profile?.permanentDistrict ?? "",
    permanentState: profile.profile?.permanentState ?? "",
    permanentPinCode: profile.profile?.permanentPinCode ?? "",
    reference1Name: profile.profile?.reference1Name ?? "",
    reference1Relationship: profile.profile?.reference1Relationship ?? "",
    reference1Contact: profile.profile?.reference1Contact ?? "",
    reference2Name: profile.profile?.reference2Name ?? "",
    reference2Relationship: profile.profile?.reference2Relationship ?? "",
    reference2Contact: profile.profile?.reference2Contact ?? "",
    presentSalary: profile.profile?.presentSalary != null ? String(profile.profile.presentSalary) : "",
    salaryExpectation: profile.profile?.salaryExpectation != null ? String(profile.profile.salaryExpectation) : "",
    salaryOffered: profile.profile?.salaryOffered != null ? String(profile.profile.salaryOffered) : "",
    joiningDate: profile.profile?.joiningDate?.slice(0, 10) ?? "",
    candidateSignatureText: profile.profile?.candidateSignatureText ?? "",
    candidateSignatureDate: profile.profile?.candidateSignatureDate?.slice(0, 10) ?? "",
    appointeeSignatureText: profile.profile?.appointeeSignatureText ?? "",
    approvalAuthoritySignatureText: profile.profile?.approvalAuthoritySignatureText ?? "",
  };
}

async function normalizeVehicleData(profile: DriverProfilePayload, client?: PoolClient) {
  if (!profile.vehicleBusId) {
    return {
      vehicleBusId: null,
      vehicleRegistrationNo: profile.vehicleRegistrationNo,
      presentReadingKm: profile.presentReadingKm,
    };
  }
  const busResult = client
    ? await client.query<{ registration_number: string; odometer_km: string }>(
        `SELECT registration_number, odometer_km::text FROM buses WHERE id = $1`,
        [profile.vehicleBusId],
      )
    : await query<{ registration_number: string; odometer_km: string }>(
        `SELECT registration_number, odometer_km::text FROM buses WHERE id = $1`,
        [profile.vehicleBusId],
      );
  const bus = busResult.rows[0];
  if (!bus) {
    return {
      vehicleBusId: null,
      vehicleRegistrationNo: profile.vehicleRegistrationNo,
      presentReadingKm: profile.presentReadingKm,
    };
  }
  return {
    vehicleBusId: profile.vehicleBusId,
    vehicleRegistrationNo: profile.vehicleRegistrationNo ?? bus.registration_number,
    presentReadingKm: profile.presentReadingKm ?? Number(bus.odometer_km),
  };
}

async function upsertDriverProfile(driverId: number, profile: DriverProfilePayload, client?: PoolClient) {
  const vehicle = await normalizeVehicleData(profile, client);
  const sql = `INSERT INTO driver_profiles(
      driver_id, blood_group, father_name, father_contact, mother_name, mother_contact, spouse_name, spouse_contact,
      child_1_name, child_2_name, pan_or_voter_id, aadhaar_no, vehicle_bus_id, vehicle_registration_no, present_reading_km,
      badge_no, badge_validity, education, date_of_birth, marital_status, religion,
      present_village, present_landmark, present_post_office, present_mandal, present_police_station, present_district,
      present_state, present_pin_code, permanent_village, permanent_landmark, permanent_post_office, permanent_mandal,
      permanent_police_station, permanent_district, permanent_state, permanent_pin_code,
      reference1_name, reference1_relationship, reference1_contact, reference2_name, reference2_relationship, reference2_contact,
      present_salary, salary_expectation, salary_offered, joining_date,
      candidate_signature_text, candidate_signature_date, appointee_signature_text, approval_authority_signature_text,
      updated_at
    )
    VALUES(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
      $16,$17,$18,$19,$20,$21,
      $22,$23,$24,$25,$26,$27,
      $28,$29,$30,$31,$32,$33,
      $34,$35,$36,$37,
      $38,$39,$40,$41,$42,$43,
      $44,$45,$46,$47,
      $48,$49,$50,$51,
      NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      blood_group = EXCLUDED.blood_group,
      father_name = EXCLUDED.father_name,
      father_contact = EXCLUDED.father_contact,
      mother_name = EXCLUDED.mother_name,
      mother_contact = EXCLUDED.mother_contact,
      spouse_name = EXCLUDED.spouse_name,
      spouse_contact = EXCLUDED.spouse_contact,
      child_1_name = EXCLUDED.child_1_name,
      child_2_name = EXCLUDED.child_2_name,
      pan_or_voter_id = EXCLUDED.pan_or_voter_id,
      aadhaar_no = EXCLUDED.aadhaar_no,
      vehicle_bus_id = EXCLUDED.vehicle_bus_id,
      vehicle_registration_no = EXCLUDED.vehicle_registration_no,
      present_reading_km = EXCLUDED.present_reading_km,
      badge_no = EXCLUDED.badge_no,
      badge_validity = EXCLUDED.badge_validity,
      education = EXCLUDED.education,
      date_of_birth = EXCLUDED.date_of_birth,
      marital_status = EXCLUDED.marital_status,
      religion = EXCLUDED.religion,
      present_village = EXCLUDED.present_village,
      present_landmark = EXCLUDED.present_landmark,
      present_post_office = EXCLUDED.present_post_office,
      present_mandal = EXCLUDED.present_mandal,
      present_police_station = EXCLUDED.present_police_station,
      present_district = EXCLUDED.present_district,
      present_state = EXCLUDED.present_state,
      present_pin_code = EXCLUDED.present_pin_code,
      permanent_village = EXCLUDED.permanent_village,
      permanent_landmark = EXCLUDED.permanent_landmark,
      permanent_post_office = EXCLUDED.permanent_post_office,
      permanent_mandal = EXCLUDED.permanent_mandal,
      permanent_police_station = EXCLUDED.permanent_police_station,
      permanent_district = EXCLUDED.permanent_district,
      permanent_state = EXCLUDED.permanent_state,
      permanent_pin_code = EXCLUDED.permanent_pin_code,
      reference1_name = EXCLUDED.reference1_name,
      reference1_relationship = EXCLUDED.reference1_relationship,
      reference1_contact = EXCLUDED.reference1_contact,
      reference2_name = EXCLUDED.reference2_name,
      reference2_relationship = EXCLUDED.reference2_relationship,
      reference2_contact = EXCLUDED.reference2_contact,
      present_salary = EXCLUDED.present_salary,
      salary_expectation = EXCLUDED.salary_expectation,
      salary_offered = EXCLUDED.salary_offered,
      joining_date = EXCLUDED.joining_date,
      candidate_signature_text = EXCLUDED.candidate_signature_text,
      candidate_signature_date = EXCLUDED.candidate_signature_date,
      appointee_signature_text = EXCLUDED.appointee_signature_text,
      approval_authority_signature_text = EXCLUDED.approval_authority_signature_text,
      updated_at = NOW()`;
  const params = [
    driverId,
    profile.bloodGroup,
    profile.fatherName,
    profile.fatherContact,
    profile.motherName,
    profile.motherContact,
    profile.spouseName,
    profile.spouseContact,
    profile.child1Name,
    profile.child2Name,
    profile.panOrVoterId,
    profile.aadhaarNo,
    vehicle.vehicleBusId,
    vehicle.vehicleRegistrationNo,
    vehicle.presentReadingKm,
    profile.badgeNo,
    profile.badgeValidity,
    profile.education,
    profile.dateOfBirth,
    profile.maritalStatus,
    profile.religion,
    profile.presentVillage,
    profile.presentLandmark,
    profile.presentPostOffice,
    profile.presentMandal,
    profile.presentPoliceStation,
    profile.presentDistrict,
    profile.presentState,
    profile.presentPinCode,
    profile.permanentVillage,
    profile.permanentLandmark,
    profile.permanentPostOffice,
    profile.permanentMandal,
    profile.permanentPoliceStation,
    profile.permanentDistrict,
    profile.permanentState,
    profile.permanentPinCode,
    profile.reference1Name,
    profile.reference1Relationship,
    profile.reference1Contact,
    profile.reference2Name,
    profile.reference2Relationship,
    profile.reference2Contact,
    profile.presentSalary,
    profile.salaryExpectation,
    profile.salaryOffered,
    profile.joiningDate,
    profile.candidateSignatureText,
    profile.candidateSignatureDate,
    profile.appointeeSignatureText,
    profile.approvalAuthoritySignatureText,
  ];
  if (client) {
    await client.query(sql, params);
    return;
  }
  await query(sql, params);
}

async function updateDriverProfile(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const driverId = Number(formData.get("driverId"));
  if (!driverId) return;

  const payload = readDriverPayload({ get: (key) => formData.get(key) as string | null });
  const validation = validateDriverCore(payload.core, payload.profile);
  if (validation) {
    redirect(`/drivers/${driverId}?error=${validation}`);
  }

  const existing = await query<{ id: number }>(
    `SELECT id FROM drivers WHERE (phone = $1 OR license_number = $2) AND id <> $3 LIMIT 1`,
    [payload.core.phone, payload.core.licenseNumber, driverId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect(`/drivers/${driverId}?error=duplicate`);
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE drivers
         SET full_name = $1,
             phone = $2,
             company_name = $3,
             bank_name = $4,
             bank_account_number = $5,
             bank_ifsc = $6,
             pf_account_number = $7,
             uan_number = $8,
             esic_number = $9,
             license_number = $10,
             license_expiry = $11,
             experience_years = $12,
             updated_at = NOW()
         WHERE id = $13`,
        [
          payload.core.fullName,
          payload.core.phone,
          payload.core.companyName,
          payload.core.bankName,
          payload.core.bankAccountNumber,
          payload.core.bankIfsc,
          payload.core.pfAccountNumber,
          payload.core.uanNumber,
          payload.core.esicNumber,
          payload.core.licenseNumber,
          payload.core.licenseExpiry,
          payload.core.experienceYears,
          driverId,
        ],
      );
      await upsertDriverProfile(driverId, payload.profile, client);
    });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23505") {
      redirect(`/drivers/${driverId}?error=duplicate_identity`);
    }
    throw error;
  }

  await logAuditEvent({ session, action: "update", entityType: "driver", entityId: driverId });

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}?updated=${Date.now()}`);
}

async function uploadDriverPhoto(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const driverId = Number(formData.get("driverId"));
  const file = formData.get("photo");
  if (!driverId || !isUploadLikeFile(file) || file.size === 0) return;
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    redirect(`/drivers/${driverId}?error=photo_too_large`);
  }

  try {
    const uploaded = await getUploadedFileBuffer(file);
    const mimeType = normalizeProfilePhotoMime(uploaded.fileName, uploaded.mimeType);
    await query(
      `UPDATE drivers
       SET profile_photo_name = $1, profile_photo_mime = $2, profile_photo_data = $3, updated_at = NOW()
       WHERE id = $4`,
      [uploaded.fileName, mimeType, uploaded.data, driverId],
    );
    await logAuditEvent({ session, action: "update", entityType: "driver_photo", entityId: driverId });
  } catch (error) {
    console.error("Driver photo upload failed", { driverId, error });
    redirect(`/drivers/${driverId}?error=photo_upload_failed`);
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}?photoUploaded=${Date.now()}`);
}

async function uploadDriverDocument(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  await ensureDocumentTables();

  const driverId = Number(formData.get("driverId"));
  const documentType = String(formData.get("documentType"));
  const documentName = String(formData.get("documentName"));
  const file = formData.get("file");

  if (!driverId || !isUploadLikeFile(file) || file.size === 0) return;

  const uploaded = await getUploadedFileBuffer(file);
  await query(
    `INSERT INTO driver_documents(driver_id, document_type, document_name, file_name, mime_type, file_size_bytes, file_data)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [driverId, documentType, documentName, uploaded.fileName, uploaded.mimeType, uploaded.sizeBytes, uploaded.data],
  );
  await logAuditEvent({ session, action: "create", entityType: "driver_document", entityId: driverId, details: { documentType, documentName } });

  revalidatePath(`/drivers/${driverId}`);
  redirect(`/drivers/${driverId}?docUploaded=${Date.now()}`);
}

async function deleteDriverDocument(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  await ensureDocumentTables();

  const driverId = Number(formData.get("driverId"));
  const documentId = Number(formData.get("documentId"));
  if (!driverId || !documentId) return;

  await query(`DELETE FROM driver_documents WHERE id = $1 AND driver_id = $2`, [documentId, driverId]);
  await logAuditEvent({ session, action: "delete", entityType: "driver_document", entityId: documentId, details: { driverId } });
  revalidatePath(`/drivers/${driverId}`);
  redirect(`/drivers/${driverId}?docDeleted=${Date.now()}`);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ docUploaded?: string; docDeleted?: string; updated?: string; photoUploaded?: string; error?: string }>;
};

export default async function DriverProfilePage(props: Props) {
  await requireSession();
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const params = await props.params;
  const searchParams = await props.searchParams;
  const [profile, buses, aiEnabled] = await Promise.all([
    driversService.getDriverProfile(Number(params.id)),
    query<{ id: number; bus_number: string; registration_number: string; odometer_km: string }>(
      `SELECT id, bus_number, registration_number, odometer_km::text
       FROM buses
       WHERE status = 'active'
       ORDER BY registration_number`,
    ),
    getAiScannerEnabled(),
  ]);
  if (!profile) notFound();

  const busOptions = buses.rows.map((bus) => ({
    id: bus.id,
    busNumber: bus.bus_number,
    registrationNumber: bus.registration_number,
    latestOdometerKm: Number(bus.odometer_km),
  }));
  const defaults = toDefaults(profile);

  return (
    <AppShell>
      <div className="space-y-4">
        {searchParams.docUploaded ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Driver document uploaded successfully.</div>
        ) : null}
        {searchParams.error === "duplicate" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Driver phone or license number already exists.</div>
        ) : null}
        {searchParams.error === "duplicate_identity" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Aadhaar or PAN/Voter ID already exists for another driver.</div>
        ) : null}
        {searchParams.error === "missing_required" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Please fill required fields: Driver Name, Contact No, Driving License No, DL Validity, Joining Date.</div>
        ) : null}
        {searchParams.error === "invalid_phone" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Contact No must contain 10 to 15 digits.</div>
        ) : null}
        {searchParams.error === "photo_too_large" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Photo is too large. Please upload a file up to 15MB.</div>
        ) : null}
        {searchParams.error === "photo_upload_failed" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Photo upload failed. Please retry with JPG/PNG/WebP.</div>
        ) : null}
        {searchParams.docDeleted ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Driver document deleted successfully.</div>
        ) : null}
        {searchParams.updated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Driver profile updated successfully.</div>
        ) : null}
        {searchParams.photoUploaded ? (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">Driver photo uploaded successfully.</div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfileAvatar name={profile.driver.full_name} src={profile.driver.has_profile_photo ? `/api/profile-photo/driver/${profile.driver.id}` : null} />
            <h2 className="text-2xl font-semibold">{profile.driver.full_name}</h2>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/reports/profile?type=driver&id=${profile.driver.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm"
            >
              Export Driver Profile (PDF)
            </a>
            <Link href="/drivers" className="text-sm text-blue-600 hover:underline">Back to Drivers</Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Driver Snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {sectionRow("Phone", profile.driver.phone)}
              {sectionRow("Company", profile.driver.company_name)}
              {sectionRow("License", profile.driver.license_number)}
              {sectionRow("DL Validity", profile.driver.license_expiry ? new Date(profile.driver.license_expiry).toLocaleDateString() : "-")}
              {sectionRow("Joining Date", profile.profile?.joiningDate ? new Date(profile.profile.joiningDate).toLocaleDateString() : "-")}
                {sectionRow("Vehicle", profile.profile?.vehicleRegistrationNo)}
                {sectionRow("Present Reading", profile.profile?.presentReadingKm != null ? String(profile.profile.presentReadingKm) : "-")}
                {sectionRow("ESIC", profile.driver.esic_number)}
              </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
            <CardContent>
              <form action={uploadDriverPhoto} className="grid gap-2">
                <input type="hidden" name="driverId" value={profile.driver.id} />
                <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif" required />
                <p className="text-xs text-muted-foreground">JPG or PNG works everywhere. HEIC (iPhone) may not display in Chrome; convert to JPG if the preview stays empty.</p>
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Upload Photo</button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Signatures</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {sectionRow("Candidate", profile.profile?.candidateSignatureText)}
              {sectionRow("Candidate Date", profile.profile?.candidateSignatureDate ?? "-")}
              {sectionRow("Appointee", profile.profile?.appointeeSignatureText)}
              {sectionRow("Approval Authority", profile.profile?.approvalAuthoritySignatureText)}
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader><CardTitle>Profile Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-3">
              <div className="space-y-1">
                <p className="font-semibold">Family</p>
                {sectionRow("Father", profile.profile?.fatherName)}
                {sectionRow("Father Contact", profile.profile?.fatherContact)}
                {sectionRow("Mother", profile.profile?.motherName)}
                {sectionRow("Mother Contact", profile.profile?.motherContact)}
                {sectionRow("Spouse", profile.profile?.spouseName)}
                {sectionRow("Spouse Contact", profile.profile?.spouseContact)}
                {sectionRow("Child 1", profile.profile?.child1Name)}
                {sectionRow("Child 2", profile.profile?.child2Name)}
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Identity & Personal</p>
                {sectionRow("PAN/Voter", profile.profile?.panOrVoterId)}
                {sectionRow("Aadhaar", profile.profile?.aadhaarNo)}
                {sectionRow("Badge No", profile.profile?.badgeNo)}
                {sectionRow("Badge Validity", profile.profile?.badgeValidity)}
                {sectionRow("Education", profile.profile?.education)}
                {sectionRow("Date of Birth", profile.profile?.dateOfBirth)}
                {sectionRow("Marital Status", profile.profile?.maritalStatus)}
                {sectionRow("Religion", profile.profile?.religion)}
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Salary & References</p>
                {sectionRow("Present Salary", profile.profile?.presentSalary != null ? String(profile.profile.presentSalary) : "-")}
                {sectionRow("Salary Expectation", profile.profile?.salaryExpectation != null ? String(profile.profile.salaryExpectation) : "-")}
                {sectionRow("Salary Offered", profile.profile?.salaryOffered != null ? String(profile.profile.salaryOffered) : "-")}
                {sectionRow("Ref 1 Name", profile.profile?.reference1Name)}
                {sectionRow("Ref 1 Relation", profile.profile?.reference1Relationship)}
                {sectionRow("Ref 1 Contact", profile.profile?.reference1Contact)}
                {sectionRow("Ref 2 Name", profile.profile?.reference2Name)}
                {sectionRow("Ref 2 Relation", profile.profile?.reference2Relationship)}
                {sectionRow("Ref 2 Contact", profile.profile?.reference2Contact)}
              </div>
              <div className="space-y-1 md:col-span-3">
                <p className="font-semibold">Address</p>
                {sectionRow("Present", [profile.profile?.presentVillage, profile.profile?.presentLandmark, profile.profile?.presentPostOffice, profile.profile?.presentMandal, profile.profile?.presentPoliceStation, profile.profile?.presentDistrict, profile.profile?.presentState, profile.profile?.presentPinCode].filter(Boolean).join(", "))}
                {sectionRow("Permanent", [profile.profile?.permanentVillage, profile.profile?.permanentLandmark, profile.profile?.permanentPostOffice, profile.profile?.permanentMandal, profile.profile?.permanentPoliceStation, profile.profile?.permanentDistrict, profile.profile?.permanentState, profile.profile?.permanentPinCode].filter(Boolean).join(", "))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader><CardTitle>Edit Driver Profile</CardTitle></CardHeader>
            <CardContent>
              <form action={updateDriverProfile} className="space-y-4">
                <FormDirtyGuard />
                <input type="hidden" name="driverId" value={profile.driver.id} />
              <DriverIntakeForm defaults={defaults} buses={busOptions} aiEnabled={aiEnabled} submitLabel="Update Driver" />
              </form>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Upload Driver Documents</CardTitle></CardHeader>
            <CardContent>
              <form action={uploadDriverDocument} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="driverId" value={profile.driver.id} />
                <div className="grid gap-1">
                  <Label htmlFor="documentType">Type</Label>
                  <select id="documentType" name="documentType" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="aadhar">
                    <option value="aadhar">Aadhaar</option>
                    <option value="pan">PAN Card</option>
                    <option value="photo">Photo</option>
                    <option value="license_copy">License Copy</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="documentName">Name</Label>
                  <Input id="documentName" name="documentName" placeholder="Aadhaar Front" required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="file">File</Label>
                  <Input id="file" name="file" type="file" required />
                </div>
                <div className="grid gap-1">
                  <Label className="invisible">Upload</Label>
                  <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Upload</button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Driver Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {profile.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              profile.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{document.document_name}</p>
                    <p className="text-xs text-muted-foreground">{document.document_type} - {new Date(document.uploaded_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="text-blue-600 hover:underline" href={`/api/documents/driver/${document.id}`} target="_blank" rel="noreferrer">View</a>
                    <form action={deleteDriverDocument}>
                      <input type="hidden" name="driverId" value={profile.driver.id} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <ConfirmSubmitButton label="Delete" message="Are you sure you want to delete this driver document?" className="text-red-600 hover:underline" />
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Route Assignment History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Bus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.routeAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No route assignments found for this driver.</TableCell>
                  </TableRow>
                ) : (
                  profile.routeAssignments.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.assignment_date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.route_name}</TableCell>
                      <TableCell className="capitalize">{entry.shift}</TableCell>
                      <TableCell>{entry.company_name ?? "-"}</TableCell>
                      <TableCell>{entry.bus_registration_number}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
