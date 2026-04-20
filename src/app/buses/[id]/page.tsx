import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { ensureDocumentTables, getUploadedFileBuffer } from "@/lib/document-storage";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { BusesService } from "@/services/buses.service";
import { FuelService } from "@/services/fuel.service";

const busesService = new BusesService();
const fuelService = new FuelService();

async function uploadBusDocument(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();
  await ensureDocumentTables();

  const busId = Number(formData.get("busId"));
  const documentType = String(formData.get("documentType"));
  const documentName = String(formData.get("documentName"));
  const file = formData.get("file");
  if (!busId || !(file instanceof File) || file.size === 0) return;

  const uploaded = await getUploadedFileBuffer(file);
  await query(
    `INSERT INTO bus_documents(bus_id, document_type, document_name, file_name, mime_type, file_size_bytes, file_data)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [busId, documentType, documentName, uploaded.fileName, uploaded.mimeType, uploaded.sizeBytes, uploaded.data],
  );
  await logAuditEvent({ session, action: "create", entityType: "bus_document", entityId: busId, details: { documentType, documentName } });

  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?docUploaded=${Date.now()}`);
}

async function deleteBusDocument(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();
  await ensureDocumentTables();

  const busId = Number(formData.get("busId"));
  const documentId = Number(formData.get("documentId"));
  if (!busId || !documentId) return;

  await query(`DELETE FROM bus_documents WHERE id = $1 AND bus_id = $2`, [documentId, busId]);
  await logAuditEvent({ session, action: "delete", entityType: "bus_document", entityId: documentId, details: { busId } });
  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?docDeleted=${Date.now()}`);
}

async function addDailyMileageEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();

  const busId = Number(formData.get("busId"));
  const odometerStart = Number(formData.get("odometerStart"));
  const odometerEnd = Number(formData.get("odometerEnd"));
  const litersFilled = Number(formData.get("litersFilled"));
  const companyName = String(formData.get("companyName"));
  if (!busId || !litersFilled) return;

  const duplicate = await query<{ id: number }>(
    `SELECT id
     FROM fuel_entries
     WHERE bus_id = $1
       AND DATE(filled_at) = CURRENT_DATE
       AND odometer_before_km = $2
       AND odometer_after_km = $3
       AND liters = $4
       AND COALESCE(company_name, '') = COALESCE($5, '')
     LIMIT 1`,
    [busId, odometerStart, odometerEnd, litersFilled, companyName],
  );
  if ((duplicate.rowCount ?? 0) > 0) {
    redirect(`/buses/${busId}?fuelError=duplicate`);
  }

  await fuelService.addFuelEntry({
    busId,
    driverId: null,
    odometerBeforeKm: odometerStart,
    odometerAfterKm: odometerEnd,
    liters: litersFilled,
    amount: 0,
    companyName,
  });
  await logAuditEvent({ session, action: "create", entityType: "fuel_entry", entityId: busId, details: { odometerStart, odometerEnd, litersFilled, companyName } });
  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?fuelSaved=${Date.now()}`);
}

async function createMaintenanceRecord(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();

  const busId = Number(formData.get("busId"));
  const maintenanceDate = String(formData.get("maintenanceDate") ?? "");
  const issueType = String(formData.get("issueType") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const cost = Number(formData.get("cost") ?? 0);

  if (!busId || !maintenanceDate || !issueType || !description || Number.isNaN(cost) || cost < 0) {
    redirect(`/buses/${busId}?maintenanceError=invalid`);
  }

  const result = await query<{ id: number }>(
    `INSERT INTO maintenance_records (bus_id, maintenance_date, issue_type, description, cost, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [busId, maintenanceDate, issueType, description, cost, session.id],
  );
  await logAuditEvent({
    session,
    action: "create",
    entityType: "maintenance_record",
    entityId: result.rows[0].id,
    details: { busId, maintenanceDate, issueType, cost },
  });
  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?maintenanceSaved=${Date.now()}`);
}

async function updateMaintenanceRecord(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();

  const busId = Number(formData.get("busId"));
  const maintenanceId = Number(formData.get("maintenanceId"));
  const maintenanceDate = String(formData.get("maintenanceDate") ?? "");
  const issueType = String(formData.get("issueType") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const cost = Number(formData.get("cost") ?? 0);

  if (
    !busId ||
    !maintenanceId ||
    !maintenanceDate ||
    !issueType ||
    !description ||
    Number.isNaN(cost) ||
    cost < 0
  ) {
    redirect(`/buses/${busId}?maintenanceError=invalid`);
  }

  const result = await query<{ id: number }>(
    `UPDATE maintenance_records
     SET maintenance_date = $1, issue_type = $2, description = $3, cost = $4
     WHERE id = $5 AND bus_id = $6
     RETURNING id`,
    [maintenanceDate, issueType, description, cost, maintenanceId, busId],
  );
  if (!result.rows[0]) {
    redirect(`/buses/${busId}?maintenanceError=notfound`);
  }
  await logAuditEvent({
    session,
    action: "update",
    entityType: "maintenance_record",
    entityId: maintenanceId,
    details: { busId, maintenanceDate, issueType, cost },
  });
  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?maintenanceUpdated=${Date.now()}`);
}

async function deleteMaintenanceRecord(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("buses");
  await ensureTransportEnhancements();

  const busId = Number(formData.get("busId"));
  const maintenanceId = Number(formData.get("maintenanceId"));
  if (!busId || !maintenanceId) return;

  await query(`DELETE FROM maintenance_records WHERE id = $1 AND bus_id = $2`, [maintenanceId, busId]);
  await logAuditEvent({
    session,
    action: "delete",
    entityType: "maintenance_record",
    entityId: maintenanceId,
    details: { busId },
  });
  revalidatePath(`/buses/${busId}`);
  redirect(`/buses/${busId}?maintenanceDeleted=${Date.now()}`);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    fuelSaved?: string;
    fuelError?: string;
    docUploaded?: string;
    docDeleted?: string;
    maintenanceSaved?: string;
    maintenanceUpdated?: string;
    maintenanceDeleted?: string;
    maintenanceError?: string;
    editMaintenanceId?: string;
  }>;
};

export default async function BusDetailPage(props: Props) {
  await requireSession();
  await requireModuleAccess("buses");
  const params = await props.params;
  const searchParams = await props.searchParams;
  const detail = await busesService.getBusDetail(Number(params.id));
  if (!detail) notFound();
  const editMaintenanceId = Number(searchParams.editMaintenanceId ?? "");
  const maintenanceToEdit = Number.isFinite(editMaintenanceId) && editMaintenanceId > 0
    ? detail.maintenance.find((record) => record.id === editMaintenanceId) ?? null
    : null;

  return (
    <AppShell>
      <div className="space-y-4">
        {searchParams.fuelSaved ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Daily mileage details saved.
          </div>
        ) : null}
        {searchParams.fuelError === "duplicate" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Duplicate daily mileage entry detected for today. Same values were already saved.
          </div>
        ) : null}
        {searchParams.docUploaded ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Bus document uploaded successfully.
          </div>
        ) : null}
        {searchParams.docDeleted ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Bus document deleted successfully.
          </div>
        ) : null}
        {searchParams.maintenanceSaved ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Maintenance record saved.
          </div>
        ) : null}
        {searchParams.maintenanceUpdated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Maintenance record updated.
          </div>
        ) : null}
        {searchParams.maintenanceDeleted ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Maintenance record deleted.
          </div>
        ) : null}
        {searchParams.maintenanceError === "invalid" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Invalid maintenance data. Please check date, issue, description, and cost.
          </div>
        ) : null}
        {searchParams.maintenanceError === "notfound" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Maintenance record not found.
          </div>
        ) : null}
        <h2 className="text-2xl font-semibold">Bus {detail.bus.busNumber}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Bus Info</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Registration: {detail.bus.registrationNumber}</p>
              <p>Make/Model: {detail.bus.make} {detail.bus.model}</p>
              <p>Seater: {detail.bus.seater}</p>
              <p>Status: {detail.bus.status}</p>
              <p>Odometer: {detail.bus.odometerKm.toLocaleString()} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Driver: {detail.assignment?.driver_name ?? "N/A"}</p>
              <p>Phone: {detail.assignment?.driver_phone ?? "N/A"}</p>
              <p>Route: {detail.assignment?.route_name ?? "N/A"}</p>
              <p>Status: {detail.assignment?.assignment_status ?? "N/A"}</p>
              <p>Employees: {detail.assignment?.employee_count ?? "0"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Today Fuel & Mileage</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Fuel: {detail.latestFuel ? `${detail.latestFuel.liters.toFixed(2)} L` : "N/A"}</p>
              <p>Company: {detail.latestFuel?.companyName ?? "N/A"}</p>
              <p>Amount: {detail.latestFuel ? `INR ${detail.latestFuel.amount.toFixed(2)}` : "N/A"}</p>
              <p>Mileage: {detail.todayMileage.toFixed(2)} km</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Odometer & Litres Update</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addDailyMileageEntry} className="grid gap-3 md:grid-cols-5">
              <input type="hidden" name="busId" value={detail.bus.id} />
              <div className="grid gap-1">
                <Label htmlFor="odometerStart">Odometer Start</Label>
                <Input id="odometerStart" name="odometerStart" type="number" step="0.01" required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="odometerEnd">Odometer End</Label>
                <Input id="odometerEnd" name="odometerEnd" type="number" step="0.01" required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="litersFilled">Litres Filled</Label>
                <Input id="litersFilled" name="litersFilled" type="number" step="0.01" required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" name="companyName" placeholder="Fuel company/vendor" required />
              </div>
              <div className="grid gap-1">
                <Label className="invisible">Save</Label>
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Save</button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Fuel History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Liters</TableHead>
                    <TableHead>KM/L</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.fuelHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.filledAt).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.odometerBeforeKm.toFixed(2)}</TableCell>
                      <TableCell>{entry.odometerAfterKm.toFixed(2)}</TableCell>
                      <TableCell>{entry.liters.toFixed(2)}</TableCell>
                      <TableCell>
                        {(
                          (entry.odometerAfterKm - entry.odometerBeforeKm) /
                          Math.max(entry.liters, 0.01)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell>{entry.companyName ?? "-"}</TableCell>
                      <TableCell>{entry.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Maintenance History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form action={maintenanceToEdit ? updateMaintenanceRecord : createMaintenanceRecord} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="busId" value={detail.bus.id} />
                {maintenanceToEdit ? <input type="hidden" name="maintenanceId" value={maintenanceToEdit.id} /> : null}
                <div className="grid gap-1">
                  <Label htmlFor="maintenanceDate">Date</Label>
                  <Input
                    id="maintenanceDate"
                    name="maintenanceDate"
                    type="date"
                    defaultValue={maintenanceToEdit?.maintenance_date ?? ""}
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="issueType">Issue</Label>
                  <Input
                    id="issueType"
                    name="issueType"
                    defaultValue={maintenanceToEdit?.issue_type ?? ""}
                    placeholder="Engine, Tyre, Brake..."
                    required
                  />
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={maintenanceToEdit?.description ?? ""}
                    placeholder="Service details"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="cost">Cost</Label>
                  <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue={maintenanceToEdit?.cost ?? ""} required />
                </div>
                <div className="flex items-end gap-2">
                  <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                    {maintenanceToEdit ? "Update Record" : "Add Record"}
                  </button>
                  {maintenanceToEdit ? (
                    <a
                      href={`/buses/${detail.bus.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm"
                    >
                      Cancel
                    </a>
                  ) : null}
                </div>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.maintenance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.maintenance_date).toLocaleDateString()}</TableCell>
                      <TableCell>{record.issue_type}</TableCell>
                      <TableCell>{Number(record.cost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/buses/${detail.bus.id}?editMaintenanceId=${record.id}`}
                            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs"
                          >
                            Edit
                          </a>
                          <form action={deleteMaintenanceRecord}>
                            <input type="hidden" name="busId" value={detail.bus.id} />
                            <input type="hidden" name="maintenanceId" value={record.id} />
                            <ConfirmSubmitButton
                              label="Delete"
                              message="Delete this maintenance record?"
                              className="inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-xs text-white hover:bg-red-700"
                            />
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {detail.maintenance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No maintenance records available.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload Bus Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={uploadBusDocument} className="grid gap-3">
                <input type="hidden" name="busId" value={detail.bus.id} />
                <div className="grid gap-1">
                  <Label htmlFor="documentType">Document Type</Label>
                  <select
                    id="documentType"
                    name="documentType"
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    defaultValue="rc"
                  >
                    <option value="rc">RC</option>
                    <option value="insurance">Insurance</option>
                    <option value="pollution">Pollution Certificate</option>
                    <option value="permit">Permit</option>
                    <option value="fitness">Fitness Certificate</option>
                    <option value="tax">Road Tax</option>
                    <option value="invoice">Invoice</option>
                    <option value="service_history">Service History</option>
                    <option value="photo">Vehicle Photo</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="documentName">Document Name</Label>
                  <Input id="documentName" name="documentName" placeholder="RC Front Copy" required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="file">File</Label>
                  <Input id="file" name="file" type="file" required />
                </div>
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                  Upload Document
                </button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bus Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bus documents uploaded yet.</p>
              ) : (
                detail.documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <p className="font-medium">{document.document_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.document_type} - {new Date(document.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/documents/bus/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                      <form action={deleteBusDocument}>
                        <input type="hidden" name="busId" value={detail.bus.id} />
                        <input type="hidden" name="documentId" value={document.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          message="Are you sure you want to delete this bus document?"
                          className="text-red-600 hover:underline"
                        />
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
