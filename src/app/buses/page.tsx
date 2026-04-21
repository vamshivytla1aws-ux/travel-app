import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BusFront } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BusesLiveCount } from "@/components/buses/buses-live-count";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { BusesService } from "@/services/buses.service";

const busesService = new BusesService();

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: "active" | "maintenance" | "inactive";
    updated?: string;
    created?: string;
    deleted?: string;
    error?: string;
  }>;
};

async function createBus(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("buses");

  const busNumber = String(formData.get("busNumber"));
  const registrationNumber = String(formData.get("registrationNumber"));
  const make = String(formData.get("make"));
  const model = String(formData.get("model"));
  const seater = Number(formData.get("seater"));
  const odometerKm = Number(formData.get("odometerKm"));

  const existing = await query<{ id: number }>(
    `SELECT id FROM buses WHERE bus_number = $1 OR registration_number = $2 LIMIT 1`,
    [busNumber, registrationNumber],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect("/buses?error=duplicate");
  }

  const result = await query<{ id: number }>(
    `INSERT INTO buses(bus_number, registration_number, make, model, seater, odometer_km, status)
     VALUES($1,$2,$3,$4,$5,$6,'active')
     RETURNING id`,
    [busNumber, registrationNumber, make, model, seater, odometerKm],
  );
  await logAuditEvent({ session, action: "create", entityType: "bus", entityId: result.rows[0].id, details: { busNumber, registrationNumber } });
  revalidatePath("/buses");
  redirect(`/buses?created=${Date.now()}`);
}

async function deleteBus(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("buses");
  const busId = Number(formData.get("busId"));
  if (!busId) return;

  const result = await busesService.deleteBus(busId);
  if ("error" in result && result.error === "not_found") return;
  await logAuditEvent({ session, action: "delete", entityType: "bus", entityId: busId });
  revalidatePath("/buses");
  redirect(`/buses?deleted=${Date.now()}`);
}

async function updateBusStatus(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("buses");

  const busId = Number(formData.get("busId"));
  const status = String(formData.get("status"));
  if (!busId || !["active", "maintenance", "inactive"].includes(status)) return;

  await query(`UPDATE buses SET status = $1, updated_at = NOW() WHERE id = $2`, [status, busId]);
  await logAuditEvent({ session, action: "update", entityType: "bus_status", entityId: busId, details: { status } });
  revalidatePath("/buses");
  redirect(`/buses?updated=${Date.now()}`);
}

export default async function BusesPage(props: Props) {
  await requireSession();
  await requireModuleAccess("buses");
  const searchParams = await props.searchParams;
  const buses = await busesService.listBuses(searchParams.q ?? "", searchParams.status);

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Fleet Management"
        subtitle="Search and filter fleet records with operational controls"
        icon={BusFront}
        tag="Fleet"
      />
      {searchParams.updated ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Bus status updated successfully.
        </div>
      ) : null}
      {searchParams.created ? (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          Bus created successfully.
        </div>
      ) : null}
      {searchParams.deleted ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Bus deleted successfully.
        </div>
      ) : null}
      {searchParams.error === "duplicate" ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Bus number or registration already exists.
        </div>
      ) : null}
      <Card className="border-slate-300">
        <CardHeader className="border-b border-slate-300 bg-white">
          <CardTitle className="text-base font-semibold">Bus Fleet - {new Date().toLocaleDateString()}</CardTitle>
          <BusesLiveCount />
        </CardHeader>
        <CardContent className="space-y-5 bg-[#f5f5f5] p-5">
          <form action={createBus} className="grid gap-3 rounded border border-slate-300 bg-white p-3 md:grid-cols-6">
            <Input name="busNumber" placeholder="Bus Number" required />
            <Input name="registrationNumber" placeholder="Registration Number" required />
            <Input name="make" placeholder="Make" required />
            <Input name="model" placeholder="Model" required />
            <Input name="seater" type="number" min={1} placeholder="Seaters" required />
            <div className="flex items-center gap-2">
              <Input name="odometerKm" type="number" placeholder="Odmoteter (kms)" required />
              <button className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">Create</button>
            </div>
          </form>
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              name="q"
              placeholder="Search by bus number and/or registration"
              defaultValue={searchParams.q}
              className="bg-white"
            />
            <button className="h-9 rounded-none bg-yellow-400 px-5 text-sm font-semibold text-black hover:bg-yellow-300">
              Search
            </button>
            <Link href="/buses" className="self-center text-xs text-slate-600 hover:underline">
              Clear
            </Link>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-700">Status</label>
              <select
                name="status"
                defaultValue={searchParams.status}
                className="h-9 rounded-none border border-slate-400 bg-white px-3 py-1 text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </form>

          <Table className="bg-white">
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Bus Number</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Seater</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Odmoteter (kms)</TableHead>
                <TableHead>Previous Day Mileage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buses.map((bus, index) => (
                <TableRow key={bus.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{bus.busNumber}</TableCell>
                  <TableCell>{bus.registrationNumber}</TableCell>
                  <TableCell>
                    {bus.make} {bus.model}
                  </TableCell>
                  <TableCell>{bus.seater}</TableCell>
                  <TableCell>
                    <Badge variant={bus.status === "active" ? "default" : "secondary"}>{bus.status}</Badge>
                  </TableCell>
                  <TableCell>{bus.odometerKm.toLocaleString()}</TableCell>
                  <TableCell>
                    {bus.previousDayMileageKmpl !== null ? `${bus.previousDayMileageKmpl.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form action={updateBusStatus} className="flex items-center gap-2">
                        <input type="hidden" name="busId" value={bus.id} />
                        <select
                          name="status"
                          defaultValue={bus.status}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="active">active</option>
                          <option value="maintenance">maintenance</option>
                          <option value="inactive">inactive</option>
                        </select>
                        <button className="h-8 rounded-md bg-primary px-2 text-xs text-primary-foreground">
                          Update
                        </button>
                      </form>
                      <Link className="text-blue-600 hover:underline" href={`/buses/${bus.id}`}>
                        View
                      </Link>
                      <form action={deleteBus}>
                        <input type="hidden" name="busId" value={bus.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          message="Are you sure you want to delete this bus?"
                          className="text-red-600 hover:underline"
                        />
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="rounded-lg border bg-muted/20 p-4">
            <h3 className="mb-3 text-sm font-semibold">Export Bus History (PDF)</h3>
            <form
              action="/api/reports/bus-history"
              method="get"
              target="_blank"
              className="grid gap-3 md:grid-cols-4"
            >
              <div className="grid gap-1">
                <label htmlFor="busId" className="text-xs text-muted-foreground">
                  Bus
                </label>
                <select
                  id="busId"
                  name="busId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue="all"
                >
                  <option value="all">All Buses</option>
                  {buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.busNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label htmlFor="mode" className="text-xs text-muted-foreground">
                  Report Mode
                </label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue="latest"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="latest">Latest entry per bus</option>
                  <option value="history">History by date range</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label htmlFor="from" className="text-xs text-muted-foreground">
                  From Date
                </label>
                <Input id="from" name="from" type="date" />
              </div>
              <div className="grid gap-1">
                <label htmlFor="to" className="text-xs text-muted-foreground">
                  To Date
                </label>
                <Input id="to" name="to" type="date" />
              </div>

              <div className="md:col-span-3 grid gap-2 md:grid-cols-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="odometer_start" defaultChecked /> Odometer Start</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="odometer_end" defaultChecked /> Odometer End</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="kms_run" defaultChecked /> KM Run</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="fuel_filled" defaultChecked /> Litres Filled</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="mileage" defaultChecked /> Mileage (KM/L)</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="field" value="company_name" defaultChecked /> Company Name</label>
              </div>

              <div className="md:col-span-1 flex items-end">
                <button className="h-9 w-full rounded-md bg-primary px-4 text-sm text-primary-foreground">
                  Export PDF
                </button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
