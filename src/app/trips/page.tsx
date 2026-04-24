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
  await tripsService.createTrip({
    busId: Number(formData.get("busId")),
    driverId: Number(formData.get("driverId")),
    routeId: Number(formData.get("routeId")),
    shiftLabel: String(formData.get("shiftLabel")),
    companyName: String(formData.get("companyName") ?? ""),
    remarks: String(formData.get("remarks") ?? ""),
  });
  await logAuditEvent({ session, action: "create", entityType: "trip" });
  revalidatePath("/trips");
  redirect(`/trips?created=${Date.now()}`);
}

async function updateTrip(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("trips");
  const tripId = Number(formData.get("tripId"));
  await tripsService.updateTripPlan({
    tripId,
    busId: Number(formData.get("busId")),
    driverId: Number(formData.get("driverId")),
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

type Props = {
  searchParams: Promise<{ created?: string; updated?: string; editId?: string; export?: string }>;
};

export default async function TripsPage(props: Props) {
  await requireSession();
  await requireModuleAccess("trips");
  const searchParams = await props.searchParams;
  const [trips, buses, drivers, routes] = await Promise.all([
    tripsService.listTodayTrips(),
    query<{ id: number; bus_number: string }>(
      `SELECT id, bus_number FROM buses WHERE status = 'active' ORDER BY bus_number`,
    ),
    query<{ id: number; full_name: string }>(
      `SELECT id, full_name FROM drivers WHERE is_active = true ORDER BY full_name`,
    ),
    query<{ id: number; route_name: string }>(
      `SELECT id, route_name FROM routes WHERE is_active = true ORDER BY route_name`,
    ),
  ]);
  const editId = Number(searchParams.editId ?? "");
  const editTrip = Number.isFinite(editId) && editId > 0
    ? trips.find((trip) => trip.id === editId && trip.status === "planned") ?? null
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

        <Card>
          <CardHeader>
            <CardTitle>{editTrip ? "Edit Trip Plan" : "Plan New Trip"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={editTrip ? updateTrip : createTrip} className="grid gap-3 md:grid-cols-6">
              <FormDirtyGuard />
              {editTrip ? <input type="hidden" name="tripId" value={editTrip.id} /> : null}
              <div className="grid gap-1">
                <Label htmlFor="busId">Bus</Label>
                <select
                  id="busId"
                  name="busId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={editTrip ? String(editTrip.bus_id) : ""}
                  required
                >
                  <option value="">Select bus</option>
                  {buses.rows.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.bus_number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="driverId">Driver</Label>
                <select
                  id="driverId"
                  name="driverId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={editTrip ? String(editTrip.driver_id) : ""}
                  required
                >
                  <option value="">Select driver</option>
                  {drivers.rows.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="routeId">Route</Label>
                <select
                  id="routeId"
                  name="routeId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={editTrip ? String(editTrip.route_id) : ""}
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
                  defaultValue={editTrip ? String(editTrip.shift_label).toLowerCase() : "morning"}
                  required
                >
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift.charAt(0).toUpperCase() + shift.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" name="companyName" placeholder="Optional company name" defaultValue={editTrip?.company_name ?? ""} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="remarks">Remarks</Label>
                <Input id="remarks" name="remarks" placeholder="Optional note" defaultValue={editTrip?.remarks ?? ""} />
              </div>
              <div className="md:col-span-6 flex items-center gap-2">
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
