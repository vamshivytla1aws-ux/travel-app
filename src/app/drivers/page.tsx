import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CarFront } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DriverIntakeDefaults, DriverIntakeForm } from "@/components/drivers/driver-intake-form";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { FormDirtyGuard } from "@/components/form-dirty-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DriverCorePayload, DriverProfilePayload, readDriverPayload, validateDriverCore } from "@/lib/driver-payload";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query, withTransaction } from "@/lib/db";
import { PoolClient } from "pg";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

function withParams(
  base: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...updates };
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value.trim().length > 0) params.set(key, value);
  });
  const serialized = params.toString();
  return serialized ? `/drivers?${serialized}` : "/drivers";
}

const EMPTY_DEFAULTS: DriverIntakeDefaults = {
  fullName: "",
  phone: "",
  companyName: "",
  licenseNumber: "",
  licenseExpiry: "",
  experienceYears: "0",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  pfAccountNumber: "",
  uanNumber: "",
  esicNumber: "",
  bloodGroup: "",
  fatherName: "",
  fatherContact: "",
  motherName: "",
  motherContact: "",
  spouseName: "",
  spouseContact: "",
  child1Name: "",
  child2Name: "",
  panOrVoterId: "",
  aadhaarNo: "",
  vehicleBusId: "",
  vehicleRegistrationNo: "",
  presentReadingKm: "",
  badgeNo: "",
  badgeValidity: "",
  education: "",
  dateOfBirth: "",
  maritalStatus: "",
  religion: "",
  presentVillage: "",
  presentLandmark: "",
  presentPostOffice: "",
  presentMandal: "",
  presentPoliceStation: "",
  presentDistrict: "",
  presentState: "",
  presentPinCode: "",
  permanentVillage: "",
  permanentLandmark: "",
  permanentPostOffice: "",
  permanentMandal: "",
  permanentPoliceStation: "",
  permanentDistrict: "",
  permanentState: "",
  permanentPinCode: "",
  reference1Name: "",
  reference1Relationship: "",
  reference1Contact: "",
  reference2Name: "",
  reference2Relationship: "",
  reference2Contact: "",
  presentSalary: "",
  salaryExpectation: "",
  salaryOffered: "",
  joiningDate: "",
  candidateSignatureText: "",
  candidateSignatureDate: "",
  appointeeSignatureText: "",
  approvalAuthoritySignatureText: "",
};

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

async function createDriver(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const payload = readDriverPayload({ get: (key) => formData.get(key) as string | null });
  const validation = validateDriverCore(payload.core, payload.profile);
  if (validation) {
    redirect(`/drivers?create=1&error=${validation}`);
  }

  const existing = await query<{ id: number }>(
    `SELECT id
     FROM drivers
     WHERE phone = $1 OR license_number = $2
     LIMIT 1`,
    [payload.core.phone, payload.core.licenseNumber],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect("/drivers?create=1&error=duplicate");
  }

  try {
    const createAnother = String(formData.get("createAnother") ?? "") === "1";
    const driverId = await withTransaction(async (client) => {
      const created = await client.query<{ id: number }>(
        `INSERT INTO drivers(
          full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number, esic_number,
          license_number, license_expiry, experience_years
        )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
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
        ],
      );
      const id = created.rows[0].id;
      await upsertDriverProfile(id, payload.profile, client);
      return id;
    });

    await logAuditEvent({
      session,
      action: "create",
      entityType: "driver",
      entityId: driverId,
      details: { phone: payload.core.phone, licenseNumber: payload.core.licenseNumber },
    });
    revalidatePath("/drivers");
    redirect(createAnother ? `/drivers?create=1&created=${Date.now()}` : `/drivers?created=${Date.now()}`);
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23505") {
      redirect("/drivers?create=1&error=duplicate_identity");
    }
    throw error;
  }
}

async function deleteDriver(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("drivers");
  const driverId = Number(formData.get("driverId"));
  if (!driverId) return;

  try {
    const deleted = await withTransaction(async (client) => {
      const result = await client.query(`DELETE FROM drivers WHERE id = $1`, [driverId]);
      return (result.rowCount ?? 0) > 0;
    });
    if (!deleted) {
      redirect("/drivers?error=notfound");
    }
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23503") {
      redirect("/drivers?error=dependency");
    }
    throw error;
  }

  await logAuditEvent({ session, action: "delete", entityType: "driver", entityId: driverId });
  revalidatePath("/drivers");
  redirect(`/drivers?deleted=${Date.now()}`);
}

type Props = {
  searchParams: Promise<{
    error?: string;
    created?: string;
    deleted?: string;
    q?: string;
    company?: string;
    page?: string;
    pageSize?: string;
    create?: string;
    export?: string;
  }>;
};

export default async function DriversPage(props: Props) {
  await requireSession();
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;
  const [drivers, buses] = await Promise.all([
    driversService.listDrivers(),
    query<{ id: number; bus_number: string; registration_number: string; odometer_km: string }>(
      `SELECT id, bus_number, registration_number, odometer_km::text
       FROM buses
       WHERE status = 'active'
       ORDER BY registration_number`,
    ),
  ]);

  const busOptions = buses.rows.map((bus) => ({
    id: bus.id,
    busNumber: bus.bus_number,
    registrationNumber: bus.registration_number,
    latestOdometerKm: Number(bus.odometer_km),
  }));

  const queryText = (searchParams.q ?? "").trim().toLowerCase();
  const company = (searchParams.company ?? "").trim().toLowerCase();
  const requestedPageSize = Number(searchParams.pageSize ?? "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 10;

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      !queryText ||
      driver.fullName.toLowerCase().includes(queryText) ||
      driver.phone.toLowerCase().includes(queryText) ||
      driver.licenseNumber.toLowerCase().includes(queryText);
    const companyValue = (driver.companyName ?? "").trim().toLowerCase();
    const matchesCompany = !company || companyValue === company;
    return matchesSearch && matchesCompany;
  });

  const companies = Array.from(
    new Set(drivers.map((driver) => (driver.companyName ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const totalItems = filteredDrivers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const parsedPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleDrivers = filteredDrivers.slice(startIndex, startIndex + pageSize);
  const baseParams = {
    q: searchParams.q,
    company: searchParams.company,
    pageSize: String(pageSize),
  };
  const pageStart = Math.max(1, currentPage - 2);
  const pageEnd = Math.min(totalPages, currentPage + 2);
  const showCreateModal = String(searchParams.create ?? "") === "1";
  const listBaseHref = withParams(
    { q: searchParams.q, company: searchParams.company, pageSize: String(pageSize), page: searchParams.page },
    { create: undefined },
  );
  const createHref = withParams(
    { q: searchParams.q, company: searchParams.company, pageSize: String(pageSize), page: searchParams.page },
    { create: "1" },
  );

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Driver Operations"
        subtitle="Maintain full driver intake profiles, references, and compliance records"
        icon={CarFront}
        tag="Driver Ops"
        actions={
          <ModuleExportLauncher
            moduleKey="drivers"
            moduleLabel="Drivers"
            basePath="/drivers"
            searchParams={{
              q: searchParams.q,
              status: undefined,
              export: searchParams.export,
              company: searchParams.company,
              page: searchParams.page,
              pageSize: searchParams.pageSize,
              create: searchParams.create,
            }}
            defaultQuery={searchParams.q ?? ""}
          />
        }
      />
      {searchParams.error === "duplicate" ? (
        <StatusAlert className="mb-4" tone="error" message="Driver phone or license number already exists." />
      ) : null}
      {searchParams.error === "duplicate_identity" ? (
        <StatusAlert className="mb-4" tone="error" message="Aadhaar or PAN/Voter ID already exists for another driver." />
      ) : null}
      {searchParams.error === "missing_required" ? (
        <StatusAlert className="mb-4" tone="error" message="Please fill required fields: Driver Name, Contact No, Driving License No, DL Validity, Joining Date." />
      ) : null}
      {searchParams.error === "invalid_phone" ? (
        <StatusAlert className="mb-4" tone="error" message="Contact No must contain 10 to 15 digits." />
      ) : null}
      {searchParams.error === "invalid_license_expiry" ? (
        <StatusAlert className="mb-4" tone="error" message="Driving License validity must be a valid date." />
      ) : null}
      {searchParams.error === "dependency" ? (
        <StatusAlert className="mb-4" tone="error" message="Driver cannot be deleted because dependent records exist." />
      ) : null}
      {searchParams.created ? (
        <StatusAlert className="mb-4" tone="success" message="Driver created successfully." />
      ) : null}
      {searchParams.deleted ? (
        <StatusAlert className="mb-4" tone="warning" message="Driver deleted permanently." />
      ) : null}
      <Card className="border-emerald-200/70 dark:border-emerald-900">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Drivers</CardTitle>
            <Link href={createHref} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Create Driver
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="mb-4 grid gap-3 rounded-md border bg-background p-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="q">Search Driver</Label>
              <Input id="q" name="q" placeholder="Name, phone, or license" defaultValue={searchParams.q ?? ""} />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <select id="company" name="company" defaultValue={searchParams.company ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All companies</option>
                {companies.map((companyName) => (
                  <option key={companyName} value={companyName}>{companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pageSize">Items per page</Label>
              <div className="flex gap-2">
                <select id="pageSize" name="pageSize" defaultValue={String(pageSize)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <Button type="submit">Apply</Button>
              </div>
            </div>
            <div className="md:col-span-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, totalItems)} of {totalItems} drivers
              </span>
              <Link className="text-blue-600 hover:underline" href="/drivers">Clear filters</Link>
            </div>
          </form>
          {(queryText || company) ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {queryText ? <span className="rounded-full border bg-muted px-2 py-1">Search: {queryText}</span> : null}
              {company ? <span className="rounded-full border bg-muted px-2 py-1">Company: {company}</span> : null}
            </div>
          ) : null}
          <Table>
            <TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Company</TableHead><TableHead>License</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleDrivers.map((driver, index) => (
                <TableRow key={driver.id}>
                  <TableCell>{startIndex + index + 1}</TableCell>
                  <TableCell><Link className="text-blue-600 hover:underline" href={`/drivers/${driver.id}`}>{driver.fullName}</Link></TableCell>
                  <TableCell>{driver.phone}</TableCell>
                  <TableCell>{driver.companyName ?? "-"}</TableCell>
                  <TableCell>{driver.licenseNumber}</TableCell>
                  <TableCell className="text-right">
                    <form action={deleteDriver}>
                      <input type="hidden" name="driverId" value={driver.id} />
                      <ConfirmSubmitButton label="Delete" message="Delete this driver permanently?" className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs text-destructive-foreground hover:opacity-90" />
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {visibleDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No drivers found for the selected search/filter.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {currentPage <= 1 ? (
                <span className={`${buttonVariants({ variant: "outline" })} pointer-events-none opacity-50`}>Previous</span>
              ) : (
                <Link className={buttonVariants({ variant: "outline" })} href={withParams(baseParams, { page: String(Math.max(1, currentPage - 1)) })}>Previous</Link>
              )}
              <div className="flex items-center gap-1">
                {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i).map((pageNumber) => (
                  <Link key={pageNumber} className={buttonVariants({ variant: pageNumber === currentPage ? "default" : "outline", size: "sm" })} href={withParams(baseParams, { page: String(pageNumber) })}>{pageNumber}</Link>
                ))}
              </div>
              {currentPage >= totalPages ? (
                <span className={`${buttonVariants({ variant: "outline" })} pointer-events-none opacity-50`}>Next</span>
              ) : (
                <Link className={buttonVariants({ variant: "outline" })} href={withParams(baseParams, { page: String(Math.min(totalPages, currentPage + 1)) })}>Next</Link>
              )}
            </div>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          </div>
        </CardContent>
      </Card>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
          <Card className="max-h-[90vh] w-full max-w-6xl overflow-y-auto border-emerald-200/70 dark:border-emerald-900">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Create Driver</CardTitle>
                <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">Close</Link>
              </div>
            </CardHeader>
            <CardContent>
              <form action={createDriver} className="space-y-4">
                <FormDirtyGuard />
                <DriverIntakeForm defaults={EMPTY_DEFAULTS} buses={busOptions} submitLabel="Save Driver" />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="createAnother" value="1" />
                  Save and add next
                </label>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
