import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BusFront, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BusesLiveCount } from "@/components/buses/buses-live-count";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
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
import { formatDateInAppTimeZone } from "@/lib/timezone";
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
    export?: string;
  }>;
};

async function createBus(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
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
  const session = await requireSession(["admin", "dispatcher", "updater"]);
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
  const session = await requireSession(["admin", "dispatcher", "updater"]);
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
        actions={
          <ModuleExportLauncher
            moduleKey="buses"
            moduleLabel="Buses"
            basePath="/buses"
            searchParams={{
              q: searchParams.q,
              status: searchParams.status,
              export: searchParams.export,
            }}
            defaultQuery={searchParams.q ?? ""}
            defaultStatus={searchParams.status ?? ""}
            busOptions={buses.map((bus) => ({
              id: bus.id,
              label: `${bus.busNumber} (${bus.registrationNumber})`,
            }))}
          />
        }
      />
      {searchParams.updated ? (
        <StatusAlert className="mb-4" tone="success" message="Bus status updated successfully." />
      ) : null}
      {searchParams.created ? (
        <StatusAlert className="mb-4" tone="success" message="Bus created successfully." />
      ) : null}
      {searchParams.deleted ? (
        <StatusAlert className="mb-4" tone="warning" message="Bus deleted successfully." />
      ) : null}
      {searchParams.error === "duplicate" ? (
        <StatusAlert className="mb-4" tone="error" message="Bus number or registration already exists." />
      ) : null}
      <Card className="mt-5 border-[#d9b966]/15 bg-[#081421]/90">
        <CardHeader className="border-b border-white/[0.07] bg-white/[0.015] sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#cda954] uppercase">Fleet Registry</p>
            <CardTitle className="font-display text-2xl">Bus Fleet</CardTitle>
            <p className="mt-1 text-xs text-[#7f8d9e]">Operational register · {formatDateInAppTimeZone(new Date())}</p>
          </div>
          <BusesLiveCount />
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <section className="rounded-xl border border-white/[0.07] bg-[#06111d]/65 p-4 shadow-[inset_0_1px_rgba(255,255,255,.02)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#eee9dd]">Register a Bus</h2>
                <p className="mt-0.5 text-xs text-[#718093]">Add a vehicle to the active fleet register.</p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#d9b966]/20 bg-[#d9b966]/10 text-[#dfbd6e]" aria-hidden>
                <Plus className="h-4 w-4" />
              </span>
            </div>
            <form action={createBus} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Input name="busNumber" placeholder="Bus number" aria-label="Bus number" required />
              <Input name="registrationNumber" placeholder="Registration number" aria-label="Registration number" required />
              <Input name="make" placeholder="Make" aria-label="Make" required />
              <Input name="model" placeholder="Model" aria-label="Model" required />
              <Input name="seater" type="number" min={1} placeholder="Seaters" aria-label="Seaters" required />
              <Input name="odometerKm" type="number" placeholder="Odometer (km)" aria-label="Odometer in kilometres" required />
              <div className="flex justify-end sm:col-span-2 xl:col-span-3">
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> Create Bus
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-[#06111d]/65 p-4 shadow-[inset_0_1px_rgba(255,255,255,.02)]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#eee9dd]">Search Fleet</h2>
              <p className="mt-0.5 text-xs text-[#718093]">Find vehicles by bus number, registration, or operating status.</p>
            </div>
            <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="bus-search">Bus or registration</Label>
                <Input
                  id="bus-search"
                  name="q"
                  placeholder="Search bus number or registration"
                  defaultValue={searchParams.q}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bus-status">Status</Label>
                <select
                  id="bus-status"
                  name="status"
                  defaultValue={searchParams.status}
                  className="h-9 rounded-lg border border-white/10 bg-[#06111d]/70 px-3 text-sm text-[#eee9dd] outline-none transition-colors focus:border-[#d9b966]/55 focus:ring-2 focus:ring-[#d9b966]/15"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <Button type="submit" size="lg">
                <Search className="h-4 w-4" /> Search
              </Button>
              <Link href="/buses" className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-[#aeb8c4] transition-colors hover:border-[#d9b966]/25 hover:bg-[#d9b966]/[0.07] hover:text-[#efd995]">
                Clear
              </Link>
            </form>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#eee9dd]">Fleet Directory</h2>
                <p className="mt-0.5 text-xs text-[#718093]">Status, mileage, and vehicle controls.</p>
              </div>
              <span className="font-mono text-xs text-[#9aa7b5]">{buses.length} records</span>
            </div>

            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Bus Number</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Seater</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Odometer (km)</TableHead>
                  <TableHead>Previous Day Mileage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.map((bus, index) => (
                  <TableRow key={bus.id}>
                    <TableCell className="font-mono text-[#748397]">{String(index + 1).padStart(2, "0")}</TableCell>
                    <TableCell className="font-mono font-semibold text-[#eee9dd]">{bus.busNumber}</TableCell>
                    <TableCell className="font-mono text-[#c3ccd5]">{bus.registrationNumber}</TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium text-[#d9dee4]" title={`${bus.make} ${bus.model}`}>
                      {bus.make} {bus.model}
                    </TableCell>
                    <TableCell className="font-mono">{bus.seater}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          bus.status === "active"
                            ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                            : bus.status === "maintenance"
                              ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"
                              : "border-white/10 bg-white/[0.04] text-[#a6b0bc]"
                        }
                      >
                        {bus.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{bus.odometerKm.toLocaleString()}</TableCell>
                    <TableCell className="font-mono">
                      {bus.previousDayMileageKmpl !== null ? `${bus.previousDayMileageKmpl.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={updateBusStatus} className="flex items-center gap-1.5">
                          <input type="hidden" name="busId" value={bus.id} />
                          <select
                            name="status"
                            aria-label={`Status for bus ${bus.busNumber}`}
                            defaultValue={bus.status}
                            className="h-8 w-[116px] rounded-lg border border-white/10 bg-[#06111d]/80 px-2 text-xs text-[#dce1e6] outline-none focus:border-[#d9b966]/45"
                          >
                            <option value="active">active</option>
                            <option value="maintenance">maintenance</option>
                            <option value="inactive">inactive</option>
                          </select>
                          <button className="h-8 rounded-lg border border-[#d9b966]/20 bg-[#d9b966]/10 px-2.5 text-xs font-semibold text-[#e5c879] transition-colors hover:bg-[#d9b966]/15">
                            Update
                          </button>
                        </form>
                        <Link className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-[#dfbd6e] transition-colors hover:bg-[#d9b966]/10" href={`/buses/${bus.id}`}>
                          View
                        </Link>
                        <form action={deleteBus}>
                          <input type="hidden" name="busId" value={bus.id} />
                          <ConfirmSubmitButton
                            label="Delete"
                            message="Are you sure you want to delete this bus?"
                            className="h-8 rounded-lg px-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-400/10 hover:text-red-200"
                          />
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {buses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-[#748397]">
                      No buses found. Adjust the filters or register a new bus.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </section>
        </CardContent>
      </Card>
    </AppShell>
  );
}
