import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { ensureDocumentTables, getUploadedFileBuffer } from "@/lib/document-storage";
import { normalizeProfilePhotoMime } from "@/lib/image-mime";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();

async function updateDriverProfile(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const driverId = Number(formData.get("driverId"));
  if (!driverId) return;

  const phone = String(formData.get("phone"));
  const licenseNumber = String(formData.get("licenseNumber"));
  const existing = await query<{ id: number }>(
    `SELECT id FROM drivers WHERE (phone = $1 OR license_number = $2) AND id <> $3 LIMIT 1`,
    [phone, licenseNumber, driverId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect(`/drivers/${driverId}?error=duplicate`);
  }

  await query(
    `UPDATE drivers
     SET full_name = $1,
         phone = $2,
         company_name = $3,
         bank_name = $4,
         bank_account_number = $5,
         bank_ifsc = $6,
         pf_account_number = $7,
         uan_number = $8,
         license_number = $9,
         license_expiry = $10,
         experience_years = $11,
         updated_at = NOW()
     WHERE id = $12`,
    [
      String(formData.get("fullName")),
      phone,
      String(formData.get("companyName")) || null,
      String(formData.get("bankName")) || null,
      String(formData.get("bankAccountNumber")) || null,
      String(formData.get("bankIfsc")) || null,
      String(formData.get("pfAccountNumber")) || null,
      String(formData.get("uanNumber")) || null,
      licenseNumber,
      String(formData.get("licenseExpiry")),
      Number(formData.get("experienceYears")),
      driverId,
    ],
  );
  await logAuditEvent({ session, action: "update", entityType: "driver", entityId: driverId });

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}?updated=${Date.now()}`);
}

async function uploadDriverPhoto(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();

  const driverId = Number(formData.get("driverId"));
  const file = formData.get("photo");
  if (!driverId || !(file instanceof File) || file.size === 0) return;

  const uploaded = await getUploadedFileBuffer(file);
  const mimeType = normalizeProfilePhotoMime(uploaded.fileName, uploaded.mimeType);
  await query(
    `UPDATE drivers
     SET profile_photo_name = $1, profile_photo_mime = $2, profile_photo_data = $3, updated_at = NOW()
     WHERE id = $4`,
    [uploaded.fileName, mimeType, uploaded.data, driverId],
  );
  await logAuditEvent({ session, action: "update", entityType: "driver_photo", entityId: driverId });

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}?photoUploaded=${Date.now()}`);
}

async function uploadDriverDocument(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  await ensureDocumentTables();

  const driverId = Number(formData.get("driverId"));
  const documentType = String(formData.get("documentType"));
  const documentName = String(formData.get("documentName"));
  const file = formData.get("file");

  if (!driverId || !(file instanceof File) || file.size === 0) return;

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
  const session = await requireSession(["admin", "dispatcher"]);
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
  const params = await props.params;
  const searchParams = await props.searchParams;
  const profile = await driversService.getDriverProfile(Number(params.id));
  if (!profile) notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        {searchParams.docUploaded ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Driver document uploaded successfully.
          </div>
        ) : null}
        {searchParams.error === "duplicate" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Driver phone or license number already exists.
          </div>
        ) : null}
        {searchParams.docDeleted ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Driver document deleted successfully.
          </div>
        ) : null}
        {searchParams.updated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Driver profile updated successfully.
          </div>
        ) : null}
        {searchParams.photoUploaded ? (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
            Driver photo uploaded successfully.
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              name={profile.driver.full_name}
              src={profile.driver.has_profile_photo ? `/api/profile-photo/driver/${profile.driver.id}` : null}
            />
            <h2 className="text-2xl font-semibold">{profile.driver.full_name}</h2>
          </div>
          <Link href="/drivers" className="text-sm text-blue-600 hover:underline">
            Back to Drivers
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Driver Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Phone: {profile.driver.phone}</p>
              <p>Company: {profile.driver.company_name ?? "-"}</p>
              <p>License: {profile.driver.license_number}</p>
              <p>Expiry: {new Date(profile.driver.license_expiry).toLocaleDateString()}</p>
              <p>Experience: {profile.driver.experience_years} years</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={uploadDriverPhoto} className="grid gap-2">
                <input type="hidden" name="driverId" value={profile.driver.id} />
                <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif" required />
                <p className="text-xs text-muted-foreground">
                  JPG or PNG works everywhere. HEIC (iPhone) may not display in Chrome; convert to JPG if the preview stays empty.
                </p>
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Upload Photo</button>
              </form>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Bank & PF Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Bank: {profile.driver.bank_name ?? "-"}</p>
              <p>Account: {profile.driver.bank_account_number ?? "-"}</p>
              <p>IFSC: {profile.driver.bank_ifsc ?? "-"}</p>
              <p>PF: {profile.driver.pf_account_number ?? "-"}</p>
              <p>UAN: {profile.driver.uan_number ?? "-"}</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Edit Driver Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateDriverProfile} className="grid gap-3 md:grid-cols-3">
                <input type="hidden" name="driverId" value={profile.driver.id} />
                <div className="grid gap-1">
                  <Label htmlFor="fullName">Name</Label>
                  <Input id="fullName" name="fullName" defaultValue={profile.driver.full_name} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={profile.driver.phone} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="companyName">Company</Label>
                  <Input id="companyName" name="companyName" defaultValue={profile.driver.company_name ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input id="licenseNumber" name="licenseNumber" defaultValue={profile.driver.license_number} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="licenseExpiry">License Expiry</Label>
                  <Input id="licenseExpiry" name="licenseExpiry" type="date" defaultValue={profile.driver.license_expiry.slice(0, 10)} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="experienceYears">Experience (Years)</Label>
                  <Input id="experienceYears" name="experienceYears" type="number" defaultValue={profile.driver.experience_years} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input id="bankName" name="bankName" defaultValue={profile.driver.bank_name ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                  <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={profile.driver.bank_account_number ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bankIfsc">IFSC</Label>
                  <Input id="bankIfsc" name="bankIfsc" defaultValue={profile.driver.bank_ifsc ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="pfAccountNumber">PF Account</Label>
                  <Input id="pfAccountNumber" name="pfAccountNumber" defaultValue={profile.driver.pf_account_number ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="uanNumber">UAN</Label>
                  <Input id="uanNumber" name="uanNumber" defaultValue={profile.driver.uan_number ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label className="invisible">Update</Label>
                  <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Update Driver</button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Upload Driver Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={uploadDriverDocument} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="driverId" value={profile.driver.id} />
                <div className="grid gap-1">
                  <Label htmlFor="documentType">Type</Label>
                  <select
                    id="documentType"
                    name="documentType"
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    defaultValue="aadhar"
                  >
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
                  <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                    Upload
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Driver Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              profile.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{document.document_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {document.document_type} - {new Date(document.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      className="text-blue-600 hover:underline"
                      href={`/api/documents/driver/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                    <form action={deleteDriverDocument}>
                      <input type="hidden" name="driverId" value={profile.driver.id} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <ConfirmSubmitButton
                        label="Delete"
                        message="Are you sure you want to delete this driver document?"
                        className="text-red-600 hover:underline"
                      />
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Assignment History</CardTitle>
          </CardHeader>
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
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No route assignments found for this driver.
                    </TableCell>
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
