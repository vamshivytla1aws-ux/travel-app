import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Timer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { FormDirtyGuard } from "@/components/form-dirty-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { TripsService } from "@/services/trips.service";

const tripsService = new TripsService();
const SHIFT_OPTIONS = ["general", "morning", "afternoon", "night", "unknown"] as const;

async function createTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const busRegistration = String(formData.get("busRegistration") ?? "").trim();
  const driverName = String(formData.get("driverName") ?? "").trim();
  const [busRow, driverRow] = await Promise.all([
    query<{ id: number }>(
      `SELECT id FROM buses
       WHERE status = 'active'
         AND (registration_number ILIKE $1 OR bus_number ILIKE $1)
       ORDER BY id DESC
       LIMIT 1`,
      [busRegistration],
    ),
    query<{ id: number }>(
      `SELECT id FROM drivers
       WHERE is_active = true AND full_name ILIKE $1
       ORDER BY id DESC
       LIMIT 1`,
      [driverName],
    ),
  ]);
  const busId = Number(busRow.rows[0]?.id ?? 0);
  const driverId = Number(driverRow.rows[0]?.id ?? 0);
  if (!busId || !driverId) {
    redirect(`/trips?error=${Date.now()}`);
  }
  await tripsService.createTrip({
    busId,
    driverId,
    routeId: Number(formData.get("routeId")),
    shiftLabel: String(formData.get("shiftLabel")),
    companyName: String(formData.get("companyName") ?? ""),
    remarks: String(formData.get("remarks") ?? ""),
  });
  await logAuditEvent({ session, action: "create", entityType: "trip" });
  revalidatePath("/trips");
  const createAnother = String(formData.get("createAnother") ?? "") === "1";
  redirect(createAnother ? `/trips?created=${Date.now()}&fast=1` : `/trips?created=${Date.now()}`);
}

async function updateTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("tripId"));
  const busRegistration = String(formData.get("busRegistration") ?? "").trim();
  const driverName = String(formData.get("driverName") ?? "").trim();
  const [busRow, driverRow] = await Promise.all([
    query<{ id: number }>(
      `SELECT id FROM buses
       WHERE status = 'active'
         AND (registration_number ILIKE $1 OR bus_number ILIKE $1)
       ORDER BY id DESC
       LIMIT 1`,
      [busRegistration],
    ),
    query<{ id: number }>(
      `SELECT id FROM drivers
       WHERE is_active = true AND full_name ILIKE $1
       ORDER BY id DESC
       LIMIT 1`,
      [driverName],
    ),
  ]);
  const busId = Number(busRow.rows[0]?.id ?? 0);
  const driverId = Number(driverRow.rows[0]?.id ?? 0);
  if (!busId || !driverId) {
    redirect(`/trips?error=${Date.now()}`);
  }
  await tripsService.updateTripPlan({
    tripId,
    busId,
    driverId,
    routeId: Number(formData.get("routeId")),
    shiftLabel: String(formData.get("shiftLabel")),
    companyName: String(formData.get("companyName") ?? ""),
    remarks: String(formData.get("remarks") ?? ""),
  });
  await logAuditEvent({ session, action: "update", entityType: "trip", entityId: tripId, details: { mode: "plan_edit" } });
  revalidatePath("/trips");
  redirect(`/trips?updated=${Date.now()}`);
}

async function startTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("tripId"));
  await tripsService.startTrip({
    tripId,
    odometerStartKm: Number(formData.get("odometerStartKm")),
  });
  await logAuditEvent({ session, action: "update", entityType: "trip", entityId: tripId, details: { status: "in_progress" } });
  revalidatePath("/trips");
}

async function completeTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("tripId"));
  await tripsService.completeTrip({
    tripId,
    odometerEndKm: Number(formData.get("odometerEndKm")),
    litersFilled: Number(formData.get("litersFilled")),
    remarks: String(formData.get("remarks") ?? ""),
  });
  await logAuditEvent({ session, action: "update", entityType: "trip", entityId: tripId, details: { status: "completed" } });
  revalidatePath("/trips");
}

async function cancelTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("tripId"));
  await tripsService.cancelTrip(tripId);
  await logAuditEvent({ session, action: "update", entityType: "trip", entityId: tripId, details: { status: "cancelled" } });
  revalidatePath("/trips");
}

async function createAdhocTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const amountRaw = String(formData.get("adhocAmount") ?? "").trim();
  const amount = amountRaw.length > 0 ? Number(amountRaw) : null;
  const busRegistration = String(formData.get("adhocBusRegistration") ?? "").trim();
  const driverName = String(formData.get("adhocDriverName") ?? "").trim();
  const [busRow, driverRow] = await Promise.all([
    query<{ id: number }>(
      `SELECT id FROM buses
       WHERE status = 'active'
         AND (registration_number ILIKE $1 OR bus_number ILIKE $1)
       ORDER BY id DESC
       LIMIT 1`,
      [busRegistration],
    ),
    query<{ id: number }>(
      `SELECT id FROM drivers
       WHERE is_active = true AND full_name ILIKE $1
       ORDER BY id DESC
       LIMIT 1`,
      [driverName],
    ),
  ]);
  const busId = Number(busRow.rows[0]?.id ?? 0);
  const driverId = Number(driverRow.rows[0]?.id ?? 0);
  if (!busId || !driverId) {
    redirect(`/trips?error=${Date.now()}`);
  }
  await tripsService.createAdhocTrip({
    busId,
    driverId,
    customerName: String(formData.get("adhocCustomerName") ?? ""),
    customerPhone: String(formData.get("adhocCustomerPhone") ?? ""),
    amount: Number.isFinite(amount as number) ? amount : null,
    fromLocation: String(formData.get("adhocFrom") ?? ""),
    toLocation: String(formData.get("adhocTo") ?? ""),
    tripDays: Number(formData.get("adhocDays")),
    remarks: String(formData.get("adhocRemarks") ?? ""),
  });
  await logAuditEvent({ session, action: "create", entityType: "adhoc_trip" });
  revalidatePath("/trips");
  redirect(`/trips?adhocCreated=${Date.now()}`);
}

async function updateAdhocTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("adhocTripId"));
  const amountRaw = String(formData.get("adhocAmount") ?? "").trim();
  const amount = amountRaw.length > 0 ? Number(amountRaw) : null;
  const busRegistration = String(formData.get("adhocBusRegistration") ?? "").trim();
  const driverName = String(formData.get("adhocDriverName") ?? "").trim();
  const [busRow, driverRow] = await Promise.all([
    query<{ id: number }>(
      `SELECT id FROM buses
       WHERE status = 'active'
         AND (registration_number ILIKE $1 OR bus_number ILIKE $1)
       ORDER BY id DESC
       LIMIT 1`,
      [busRegistration],
    ),
    query<{ id: number }>(
      `SELECT id FROM drivers
       WHERE is_active = true AND full_name ILIKE $1
       ORDER BY id DESC
       LIMIT 1`,
      [driverName],
    ),
  ]);
  const busId = Number(busRow.rows[0]?.id ?? 0);
  const driverId = Number(driverRow.rows[0]?.id ?? 0);
  if (!busId || !driverId) {
    redirect(`/trips?error=${Date.now()}`);
  }
  await tripsService.updateAdhocTrip({
    tripId,
    busId,
    driverId,
    customerName: String(formData.get("adhocCustomerName") ?? ""),
    customerPhone: String(formData.get("adhocCustomerPhone") ?? ""),
    amount: Number.isFinite(amount as number) ? amount : null,
    fromLocation: String(formData.get("adhocFrom") ?? ""),
    toLocation: String(formData.get("adhocTo") ?? ""),
    tripDays: Number(formData.get("adhocDays")),
    remarks: String(formData.get("adhocRemarks") ?? ""),
  });
  await logAuditEvent({ session, action: "update", entityType: "adhoc_trip", entityId: tripId });
  revalidatePath("/trips");
  redirect(`/trips?adhocUpdated=${Date.now()}`);
}

async function deleteAdhocTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("adhocTripId"));
  await tripsService.deleteAdhocTrip(tripId);
  await logAuditEvent({ session, action: "delete", entityType: "adhoc_trip", entityId: tripId });
  revalidatePath("/trips");
  redirect(`/trips?adhocDeleted=${Date.now()}`);
}

type Props = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    editId?: string;
    duplicateId?: string;
    export?: string;
    fast?: string;
    adhocCreated?: string;
    adhocUpdated?: string;
    adhocDeleted?: string;
    adhocEditId?: string;
    adhocPage?: string;
  }>;
};

export default async function TripsPage(props: Props) {
  await requireSession();
  await requireModuleAccess("trips");
  const searchParams = await props.searchParams;
  const adhocPage = Math.max(1, Number(searchParams.adhocPage ?? "1") || 1);
  const [trips, adhocTripsResult, buses, drivers, routes] = await Promise.all([
    tripsService.listTodayTrips(),
    tripsService.listRecentAdhocTrips(adhocPage, 10),
    query<{ id: number; bus_number: string; registration_number: string }>(
      `SELECT id, bus_number, registration_number FROM buses WHERE status = 'active' ORDER BY registration_number`,
    ),
    query<{ id: number; full_name: string }>(
      `SELECT id, full_name FROM drivers WHERE is_active = true ORDER BY full_name`,
    ),
    query<{ id: number; route_name: string }>(
      `SELECT id, route_name FROM routes WHERE is_active = true ORDER BY route_name`,
    ),
  ]);
  const adhocTrips = adhocTripsResult.rows;
  const adhocTotalPages = Math.max(1, Math.ceil(adhocTripsResult.total / adhocTripsResult.pageSize));
  const editId = Number(searchParams.editId ?? "");
  const editTrip = Number.isFinite(editId) && editId > 0
    ? trips.find((trip) => trip.id === editId && trip.status === "planned") ?? null
    : null;
  const duplicateId = Number(searchParams.duplicateId ?? "");
  const duplicateTrip = !editTrip && Number.isFinite(duplicateId) && duplicateId > 0
    ? trips.find((trip) => trip.id === duplicateId) ?? null
    : null;
  const formSource = editTrip ?? duplicateTrip;
  const adhocEditId = Number(searchParams.adhocEditId ?? "");
  const adhocEditTrip =
    Number.isFinite(adhocEditId) && adhocEditId > 0
      ? adhocTrips.find((trip) => trip.id === adhocEditId) ?? null
      : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Trip Lifecycle"
          subtitle="Plan, start, complete, and monitor today’s trips from one operational workspace"
          icon={Timer}
          tag="Trip Control"
          actions={
            <ModuleExportLauncher
              moduleKey="trips"
              moduleLabel="Trips"
              basePath="/trips"
              searchParams={{
                export: searchParams.export,
                created: searchParams.created,
                updated: searchParams.updated,
                editId: searchParams.editId,
              }}
            />
          }
        />

        {searchParams.created ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Trip planned successfully.
          </div>
        ) : null}
        {searchParams.updated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Trip plan updated successfully.
          </div>
        ) : null}
        {searchParams.adhocCreated ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Adhoc trip created successfully.
          </div>
        ) : null}
        {searchParams.adhocUpdated ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Adhoc trip updated successfully.
          </div>
        ) : null}
        {searchParams.adhocDeleted ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Adhoc trip deleted successfully.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{editTrip ? "Edit Trip Plan" : "Plan New Trip"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={editTrip ? updateTrip : createTrip} className="grid gap-3 md:grid-cols-6">
              <FormDirtyGuard />
              {editTrip ? <input type="hidden" name="tripId" value={editTrip.id} /> : null}
              <div className="grid gap-1">
                <Label htmlFor="busRegistration">Registration</Label>
                <Input
                  id="busRegistration"
                  name="busRegistration"
                  list="trip-bus-options"
                  placeholder="Type registration or bus number"
                  defaultValue={formSource?.registration_number ?? ""}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="driverName">Driver</Label>
                <Input
                  id="driverName"
                  name="driverName"
                  list="trip-driver-options"
                  placeholder="Type driver name"
                  defaultValue={formSource?.driver_name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="routeId">Route</Label>
                <select
                  id="routeId"
                  name="routeId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={formSource ? String(formSource.route_id) : ""}
                  required
                >
                  <option value="">Select route</option>
                  {routes.rows.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.route_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="shiftLabel">Shift</Label>
                <select
                  id="shiftLabel"
                  name="shiftLabel"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={formSource ? String(formSource.shift_label).toLowerCase() : "morning"}
                  required
                >
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift.charAt(0).toUpperCase() + shift.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:col-span-2">
                <div className="grid gap-1">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" name="companyName" placeholder="Company name" defaultValue={formSource?.company_name ?? ""} />
                </div>
              </div>
              <div className="grid gap-3 md:col-span-2">
                <div className="grid gap-1">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input id="remarks" name="remarks" placeholder="Remarks" defaultValue={formSource?.remarks ?? ""} />
                </div>
              </div>
              <div className="md:col-span-6 flex items-center gap-2">
                {!editTrip ? (
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="createAnother" value="1" defaultChecked={searchParams.fast === "1"} />
                    Save and add next
                  </label>
                ) : null}
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                  {editTrip ? "Update Trip" : "Create Trip"}
                </button>
                {editTrip ? (
                  <Link href="/trips" className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm">
                    Cancel Edit
                  </Link>
                ) : null}
              </div>
            </form>
            <datalist id="trip-bus-options">
              {buses.rows.map((bus) => (
                <option key={bus.id} value={bus.registration_number}>{bus.bus_number}</option>
              ))}
            </datalist>
            <datalist id="trip-driver-options">
              {drivers.rows.map((driver) => (
                <option key={driver.id} value={driver.full_name} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{adhocEditTrip ? "Edit Adhoc Trip" : "Adhoc Trips"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={adhocEditTrip ? updateAdhocTrip : createAdhocTrip} className="grid gap-3 md:grid-cols-6">
              {adhocEditTrip ? <input type="hidden" name="adhocTripId" value={adhocEditTrip.id} /> : null}
              <div className="grid gap-1">
                <Label htmlFor="adhocBusRegistration">Registration</Label>
                <Input
                  id="adhocBusRegistration"
                  name="adhocBusRegistration"
                  list="adhoc-bus-options"
                  placeholder="Type registration or bus number"
                  defaultValue={adhocEditTrip?.registration_number ?? ""}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocDriverName">Driver</Label>
                <Input
                  id="adhocDriverName"
                  name="adhocDriverName"
                  list="adhoc-driver-options"
                  placeholder="Type driver name"
                  defaultValue={adhocEditTrip?.driver_name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocCustomerName">Customer Name</Label>
                <Input id="adhocCustomerName" name="adhocCustomerName" defaultValue={adhocEditTrip?.customer_name ?? ""} required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocCustomerPhone">Phone Number</Label>
                <Input id="adhocCustomerPhone" name="adhocCustomerPhone" defaultValue={adhocEditTrip?.customer_phone ?? ""} required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocAmount">Amount</Label>
                <Input
                  id="adhocAmount"
                  name="adhocAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={adhocEditTrip?.amount ?? ""}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocFrom">From</Label>
                <Input id="adhocFrom" name="adhocFrom" placeholder="Start location" defaultValue={adhocEditTrip?.from_location ?? ""} required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocTo">To</Label>
                <Input id="adhocTo" name="adhocTo" placeholder="Destination" defaultValue={adhocEditTrip?.to_location ?? ""} required />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocDays">Days</Label>
                <Input
                  id="adhocDays"
                  name="adhocDays"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={adhocEditTrip ? String(adhocEditTrip.trip_days) : "1"}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="adhocRemarks">Remarks</Label>
                <Input id="adhocRemarks" name="adhocRemarks" placeholder="Optional note" defaultValue={adhocEditTrip?.remarks ?? ""} />
              </div>
              <div className="md:col-span-6 flex items-center gap-2">
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                  {adhocEditTrip ? "Update Adhoc Trip" : "Create Adhoc Trip"}
                </button>
                {adhocEditTrip ? (
                  <Link href="/trips" className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm">
                    Cancel Edit
                  </Link>
                ) : null}
              </div>
            </form>
            <datalist id="adhoc-bus-options">
              {buses.rows.map((bus) => (
                <option key={`adhoc-bus-${bus.id}`} value={bus.registration_number}>{bus.bus_number}</option>
              ))}
            </datalist>
            <datalist id="adhoc-driver-options">
              {drivers.rows.map((driver) => (
                <option key={`adhoc-driver-${driver.id}`} value={driver.full_name} />
              ))}
            </datalist>

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adhocTrips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">
                        No adhoc trips created yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    adhocTrips.map((trip, index) => (
                      <TableRow key={trip.id}>
                        <TableCell>{(adhocPage - 1) * 10 + index + 1}</TableCell>
                        <TableCell>{trip.trip_date}</TableCell>
                        <TableCell>{trip.registration_number}</TableCell>
                        <TableCell>{trip.driver_name}</TableCell>
                        <TableCell>{trip.customer_name}</TableCell>
                        <TableCell>{trip.customer_phone}</TableCell>
                        <TableCell>{trip.amount != null ? Number(trip.amount).toFixed(2) : "-"}</TableCell>
                        <TableCell>{trip.from_location}</TableCell>
                        <TableCell>{trip.to_location}</TableCell>
                        <TableCell>{trip.trip_days}</TableCell>
                        <TableCell>{trip.remarks ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link href={`/trips?adhocEditId=${trip.id}&adhocPage=${adhocPage}`} className="inline-flex h-8 items-center rounded border px-3 text-xs">
                              Edit
                            </Link>
                            <form action={deleteAdhocTrip}>
                              <input type="hidden" name="adhocTripId" value={trip.id} />
                              <button className="inline-flex h-8 items-center rounded border border-red-300 px-3 text-xs text-red-600">
                                Delete
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <Link
                href={`/trips?adhocPage=${Math.max(1, adhocPage - 1)}`}
                className={`rounded border px-3 py-1 ${adhocPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                Prev
              </Link>
              <span>
                {adhocPage}/{adhocTotalPages}
              </span>
              <Link
                href={`/trips?adhocPage=${Math.min(adhocTotalPages, adhocPage + 1)}`}
                className={`rounded border px-3 py-1 ${adhocPage >= adhocTotalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                Next
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today Trip Board</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No trips planned today.
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip, index) => (
                    <TableRow key={trip.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{trip.bus_number}</TableCell>
                      <TableCell>{trip.driver_name}</TableCell>
                      <TableCell>{trip.route_name}</TableCell>
                      <TableCell>{trip.shift_label}</TableCell>
                      <TableCell>{trip.company_name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trip.status === "completed"
                              ? "default"
                              : trip.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {trip.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {trip.status === "completed" ? (
                          <div>
                            <p>KM: {Number(trip.km_run ?? 0).toFixed(2)}</p>
                            <p>Fuel: {Number(trip.liters_filled ?? 0).toFixed(2)} L</p>
                            <p>Mileage: {Number(trip.mileage_kmpl ?? 0).toFixed(2)} km/l</p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {trip.status === "planned" ? (
                          <div className="flex justify-end gap-2">
                            <Link href={`/trips?editId=${trip.id}`} className="inline-flex h-8 items-center rounded border px-3 text-xs">
                              Edit
                            </Link>
                            <Link href={`/trips?duplicateId=${trip.id}`} className="inline-flex h-8 items-center rounded border px-3 text-xs">
                              Duplicate
                            </Link>
                            <form action={startTrip} className="flex items-center gap-2">
                              <input type="hidden" name="tripId" value={trip.id} />
                              <Input
                                name="odometerStartKm"
                                type="number"
                                step="0.01"
                                placeholder="Start Odo"
                                className="h-8 w-28"
                                required
                              />
                              <button className="h-8 rounded bg-blue-600 px-3 text-xs text-white">Start</button>
                            </form>
                            <form action={cancelTrip}>
                              <input type="hidden" name="tripId" value={trip.id} />
                              <button className="h-8 rounded border border-red-300 px-3 text-xs text-red-600">Cancel</button>
                            </form>
                          </div>
                        ) : null}

                        {trip.status === "in_progress" ? (
                          <div className="flex justify-end gap-2">
                            <form action={completeTrip} className="flex items-center gap-2">
                              <input type="hidden" name="tripId" value={trip.id} />
                              <Input
                                name="odometerEndKm"
                                type="number"
                                step="0.01"
                                placeholder="End Odo"
                                className="h-8 w-24"
                                required
                              />
                              <Input
                                name="litersFilled"
                                type="number"
                                step="0.01"
                                placeholder="Litres"
                                className="h-8 w-20"
                                required
                              />
                              <button className="h-8 rounded bg-emerald-600 px-3 text-xs text-white">Complete</button>
                            </form>
                            <form action={cancelTrip}>
                              <input type="hidden" name="tripId" value={trip.id} />
                              <button className="h-8 rounded border border-red-300 px-3 text-xs text-red-600">Cancel</button>
                            </form>
                          </div>
                        ) : null}
                      </TableCell>
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
