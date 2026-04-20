import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { getUploadedFileBuffer } from "@/lib/document-storage";
import { normalizeProfilePhotoMime } from "@/lib/image-mime";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { EmployeesService } from "@/services/employees.service";

const employeesService = new EmployeesService();

async function updateEmployeeProfile(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("employees");
  await ensureTransportEnhancements();

  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) return;

  const employeeCode = String(formData.get("employeeCode"));
  const email = String(formData.get("email") ?? "").trim() || null;
  const existing = await query<{ id: number }>(
    `SELECT id FROM employees
     WHERE id <> $3
       AND (
         employee_code = $1
         OR ($2::varchar IS NOT NULL AND email IS NOT NULL AND lower(email) = lower($2::varchar))
       )
     LIMIT 1`,
    [employeeCode, email, employeeId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect(`/employees/${employeeId}?error=duplicate`);
  }

  await query(
    `UPDATE employees
     SET employee_code = $1,
         full_name = $2,
         phone = $3,
         email = $4,
         company_name = $5,
         gender = $6,
         blood_group = $7,
         valid_from = $8,
         valid_to = $9,
         department = $10,
         pickup_address = $11,
         drop_address = $12,
         updated_at = NOW()
     WHERE id = $13`,
    [
      employeeCode,
      String(formData.get("fullName")),
      String(formData.get("phone")) || null,
      email,
      String(formData.get("companyName")) || null,
      String(formData.get("gender")) || null,
      String(formData.get("bloodGroup")) || null,
      String(formData.get("validFrom")) || null,
      String(formData.get("validTo")) || null,
      String(formData.get("department")),
      String(formData.get("pickupAddress")),
      String(formData.get("dropAddress")),
      employeeId,
    ],
  );
  await logAuditEvent({ session, action: "update", entityType: "employee", entityId: employeeId });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  redirect(`/employees/${employeeId}?updated=${Date.now()}`);
}

async function uploadEmployeePhoto(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("employees");
  await ensureTransportEnhancements();

  const employeeId = Number(formData.get("employeeId"));
  const file = formData.get("photo");
  if (!employeeId || !(file instanceof File) || file.size === 0) return;

  const uploaded = await getUploadedFileBuffer(file);
  const mimeType = normalizeProfilePhotoMime(uploaded.fileName, uploaded.mimeType);
  await query(
    `UPDATE employees
     SET profile_photo_name = $1, profile_photo_mime = $2, profile_photo_data = $3, updated_at = NOW()
     WHERE id = $4`,
    [uploaded.fileName, mimeType, uploaded.data, employeeId],
  );
  await logAuditEvent({ session, action: "update", entityType: "employee_photo", entityId: employeeId });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  redirect(`/employees/${employeeId}?photoUploaded=${Date.now()}`);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; photoUploaded?: string; error?: string }>;
};

export default async function EmployeeProfilePage(props: Props) {
  await requireSession();
  await requireModuleAccess("employees");
  await ensureTransportEnhancements();

  const params = await props.params;
  const searchParams = await props.searchParams;
  const employee = await employeesService.getEmployee(Number(params.id));
  if (!employee) notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        {searchParams.updated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Employee profile updated successfully.
          </div>
        ) : null}
        {searchParams.photoUploaded ? (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
            Employee photo uploaded successfully.
          </div>
        ) : null}
        {searchParams.error === "duplicate" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Employee code or email already exists.
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              name={employee.fullName}
              src={employee.hasProfilePhoto ? `/api/profile-photo/employee/${employee.id}` : null}
            />
            <h2 className="text-2xl font-semibold">{employee.fullName}</h2>
          </div>
          <Link href="/employees" className="text-sm text-blue-600 hover:underline">
            Back to Employees
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Profile Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Email: {employee.email ?? "-"}</p>
              <p>Phone: {employee.phone ?? "-"}</p>
              <p>Company: {employee.companyName ?? "-"}</p>
              <p>Gender: {employee.gender ?? "-"}</p>
              <p>Blood Group: {employee.bloodGroup ?? "-"}</p>
              <p>Valid From: {employee.validFrom ? new Date(employee.validFrom).toLocaleDateString() : "-"}</p>
              <p>Valid To: {employee.validTo ? new Date(employee.validTo).toLocaleDateString() : "-"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={uploadEmployeePhoto} className="grid gap-2">
                <input type="hidden" name="employeeId" value={employee.id} />
                <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif" required />
                <p className="text-xs text-muted-foreground">
                  JPG or PNG works everywhere. HEIC (iPhone) may not display in Chrome; convert to JPG if the preview stays empty.
                </p>
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Upload Photo</button>
              </form>
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Edit Employee Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateEmployeeProfile} className="grid gap-3 md:grid-cols-3">
                <input type="hidden" name="employeeId" value={employee.id} />
                <div className="grid gap-1">
                  <Label htmlFor="employeeCode">Code</Label>
                  <Input id="employeeCode" name="employeeCode" defaultValue={employee.employeeCode} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="fullName">Name</Label>
                  <Input id="fullName" name="fullName" defaultValue={employee.fullName} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="companyName">Company</Label>
                  <Input id="companyName" name="companyName" defaultValue={employee.companyName ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" name="department" defaultValue={employee.department} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    defaultValue={employee.gender ?? ""}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Input id="bloodGroup" name="bloodGroup" defaultValue={employee.bloodGroup ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="validFrom">Valid From</Label>
                  <Input id="validFrom" name="validFrom" type="date" defaultValue={employee.validFrom?.slice(0, 10) ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="validTo">Valid To / Expiry</Label>
                  <Input id="validTo" name="validTo" type="date" defaultValue={employee.validTo?.slice(0, 10) ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="pickupAddress">Pickup Address</Label>
                  <Input id="pickupAddress" name="pickupAddress" defaultValue={employee.pickupAddress} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dropAddress">Drop Address</Label>
                  <Input id="dropAddress" name="dropAddress" defaultValue={employee.dropAddress} required />
                </div>
                <div className="grid gap-1">
                  <Label className="invisible">Update</Label>
                  <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Update Employee</button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
