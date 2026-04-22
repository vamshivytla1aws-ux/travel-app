import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Fuel } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { getUploadedFileBuffer } from "@/lib/document-storage";
import { safeDecodeURIComponent } from "@/lib/url";
import { FuelTruckService } from "@/services/fuel-truck.service";
import { BusSearchSelect } from "@/components/fuel-trucks/bus-search-select";
import { RefillAmountFields } from "@/components/fuel-trucks/refill-amount-fields";

const fuelTruckService = new FuelTruckService();
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function createFuelTruck(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");

  try {
    const truckId = await fuelTruckService.createFuelTruck({
      truckCode: String(formData.get("truckCode") ?? ""),
      truckName: String(formData.get("truckName") ?? ""),
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      tankCapacityLiters: Number(formData.get("tankCapacityLiters") ?? 0),
      currentAvailableLiters: Number(formData.get("currentAvailableLiters") ?? 0),
      lowStockThresholdLiters: Number(formData.get("lowStockThresholdLiters") ?? 0),
      status: String(formData.get("status") ?? "active") as "active" | "inactive",
      notes: String(formData.get("notes") ?? ""),
      userId: session.id,
    });

    await logAuditEvent({
      session,
      action: "create",
      entityType: "fuel_truck",
      entityId: truckId,
      details: { truckCode: String(formData.get("truckCode") ?? "") },
    });
    revalidatePath("/fuel-trucks");
    redirect(`/fuel-trucks?created=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create fuel tanker";
    redirect(`/fuel-trucks?error=${encodeURIComponent(message)}`);
  }
}

async function addRefill(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");

  const receiptFile = formData.get("receipt");
  const receipt =
    receiptFile instanceof File && receiptFile.size > 0 ? await getUploadedFileBuffer(receiptFile) : null;

  try {
    const result = await fuelTruckService.addRefill({
      fuelTruckId: Number(formData.get("fuelTruckId")),
      refillDate: String(formData.get("refillDate") ?? ""),
      refillTime: String(formData.get("refillTime") ?? ""),
      odometerReading: formData.get("odometerReading") ? Number(formData.get("odometerReading")) : null,
      fuelStationName: String(formData.get("fuelStationName") ?? ""),
      vendorName: String(formData.get("vendorName") ?? ""),
      quantityLiters: Number(formData.get("quantityLiters")),
      ratePerLiter: Number(formData.get("ratePerLiter")),
      totalAmount: Number(formData.get("totalAmount")),
      billNumber: String(formData.get("billNumber") ?? ""),
      paymentMode: String(formData.get("paymentMode") ?? ""),
      driverName: String(formData.get("driverName") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      receipt: receipt
        ? {
            fileName: receipt.fileName,
            mimeType: receipt.mimeType,
            sizeBytes: receipt.sizeBytes,
            data: receipt.data,
          }
        : null,
      userId: session.id,
    });

    await logAuditEvent({
      session,
      action: "create",
      entityType: "fuel_truck_refill",
      entityId: result.refillId,
      details: {
        fuelTruckId: Number(formData.get("fuelTruckId")),
        quantityLiters: Number(formData.get("quantityLiters")),
        closingStock: result.closingStock,
      },
    });
    revalidatePath("/fuel-trucks");
    revalidatePath("/dashboard");
    redirect(`/fuel-trucks?refilled=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save refill";
    redirect(`/fuel-trucks?error=${encodeURIComponent(message)}`);
  }
}

async function addIssue(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");

  try {
    const busId = Number(formData.get("busId"));
    if (!Number.isFinite(busId) || busId <= 0) {
      redirect(`/fuel-trucks?error=${encodeURIComponent("Please select a bus from the list before saving issue.")}`);
    }
    const result = await fuelTruckService.addIssue({
      fuelTruckId: Number(formData.get("fuelTruckId")),
      busId,
      issueDate: String(formData.get("issueDate") ?? ""),
      issueTime: String(formData.get("issueTime") ?? ""),
      litersIssued: Number(formData.get("litersIssued")),
      odometerBeforeKm: optionalNumber(formData, "odometerBeforeKm"),
      odometerAfterKm: optionalNumber(formData, "odometerAfterKm"),
      issuedByName: String(formData.get("issuedByName") ?? ""),
      busDriverName: String(formData.get("busDriverName") ?? ""),
      routeReference: String(formData.get("routeReference") ?? ""),
      remarks: String(formData.get("remarks") ?? ""),
      userId: session.id,
    });

    await logAuditEvent({
      session,
      action: "create",
      entityType: "fuel_truck_issue",
      entityId: result.issueId,
      details: {
        fuelTruckId: Number(formData.get("fuelTruckId")),
        busId,
        litersIssued: Number(formData.get("litersIssued")),
        closingStock: result.closingStock,
      },
    });
    revalidatePath("/fuel-trucks");
    if (busId) revalidatePath(`/buses/${busId}`);
    revalidatePath("/dashboard");
    redirect(`/fuel-trucks?issued=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save issue";
    redirect(`/fuel-trucks?error=${encodeURIComponent(message)}`);
  }
}

type Props = {
  searchParams: Promise<{
    created?: string;
    refilled?: string;
    issued?: string;
    refillDeleted?: string;
    issueDeleted?: string;
    q?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    fuelTruckId?: string;
    busId?: string;
    fuelStation?: string;
    driver?: string;
    page?: string;
    pageSize?: string;
    action?: string;
    export?: string;
    error?: string;
  }>;
};

async function deleteRefillReportEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");
  const refillId = Number(formData.get("refillId"));
  if (!refillId) return;
  try {
    const result = await fuelTruckService.deleteRefill(refillId, session.id);
    await logAuditEvent({
      session,
      action: "delete",
      entityType: "fuel_truck_refill",
      entityId: refillId,
      details: { fuelTruckId: result.fuelTruckId },
    });
    revalidatePath("/fuel-trucks");
    revalidatePath("/dashboard");
    redirect(`/fuel-trucks?refillDeleted=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete refill entry";
    redirect(`/fuel-trucks?error=${encodeURIComponent(message)}`);
  }
}

async function deleteIssueReportEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");
  const issueId = Number(formData.get("issueId"));
  if (!issueId) return;
  try {
    const result = await fuelTruckService.deleteIssue(issueId, session.id);
    await logAuditEvent({
      session,
      action: "delete",
      entityType: "fuel_truck_issue",
      entityId: issueId,
      details: { fuelTruckId: result.fuelTruckId, busId: result.busId },
    });
    revalidatePath("/fuel-trucks");
    revalidatePath("/dashboard");
    if (result.busId) revalidatePath(`/buses/${result.busId}`);
    redirect(`/fuel-trucks?issueDeleted=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete issue entry";
    redirect(`/fuel-trucks?error=${encodeURIComponent(message)}`);
  }
}

export default async function FuelTrucksPage(props: Props) {
  await requireSession();
  await requireModuleAccess("fuel-truck");
  const searchParams = await props.searchParams;

  const [trucks, summary, buses, reports] = await Promise.all([
    fuelTruckService.listFuelTrucks(
      String(searchParams.q ?? ""),
      (searchParams.status === "active" || searchParams.status === "inactive"
        ? searchParams.status
        : undefined) as "active" | "inactive" | undefined,
    ),
    fuelTruckService.getSummary(),
    query<{ id: number; bus_number: string; registration_number: string; odometer_km: string | null }>(
      `SELECT id, bus_number, registration_number, odometer_km::text
       FROM buses
       WHERE status = 'active'
       ORDER BY bus_number`,
    ),
    fuelTruckService.getReports({
      fromDate: searchParams.fromDate,
      toDate: searchParams.toDate,
      fuelTruckId: searchParams.fuelTruckId ? Number(searchParams.fuelTruckId) : undefined,
      busId: searchParams.busId ? Number(searchParams.busId) : undefined,
      fuelStation: searchParams.fuelStation,
      driver: searchParams.driver,
    }),
  ]);

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);
  const requestedPageSize = Number(searchParams.pageSize ?? "15");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 15;
  const totalTrucks = trucks.length;
  const totalPages = Math.max(1, Math.ceil(totalTrucks / pageSize));
  const rawPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleTrucks = trucks.slice(startIndex, startIndex + pageSize);
  const activeFilters = [
    searchParams.q ? `Search: ${searchParams.q}` : null,
    searchParams.status ? `Status: ${searchParams.status}` : null,
    searchParams.fromDate ? `From: ${searchParams.fromDate}` : null,
    searchParams.toDate ? `To: ${searchParams.toDate}` : null,
    searchParams.fuelStation ? `Station: ${searchParams.fuelStation}` : null,
    searchParams.driver ? `Driver: ${searchParams.driver}` : null,
  ].filter(Boolean) as string[];
  const listBaseParams = new URLSearchParams();
  if (searchParams.q) listBaseParams.set("q", String(searchParams.q));
  if (searchParams.status) listBaseParams.set("status", String(searchParams.status));
  if (searchParams.fromDate) listBaseParams.set("fromDate", String(searchParams.fromDate));
  if (searchParams.toDate) listBaseParams.set("toDate", String(searchParams.toDate));
  if (searchParams.fuelTruckId) listBaseParams.set("fuelTruckId", String(searchParams.fuelTruckId));
  if (searchParams.busId) listBaseParams.set("busId", String(searchParams.busId));
  if (searchParams.fuelStation) listBaseParams.set("fuelStation", String(searchParams.fuelStation));
  if (searchParams.driver) listBaseParams.set("driver", String(searchParams.driver));
  if (searchParams.page) listBaseParams.set("page", String(searchParams.page));
  if (searchParams.pageSize) listBaseParams.set("pageSize", String(searchParams.pageSize));
  const listBaseHref = `/fuel-trucks${listBaseParams.toString() ? `?${listBaseParams.toString()}` : ""}`;
  const createParams = new URLSearchParams(listBaseParams);
  createParams.set("action", "create");
  const refillParams = new URLSearchParams(listBaseParams);
  refillParams.set("action", "refill");
  const issueParams = new URLSearchParams(listBaseParams);
  issueParams.set("action", "issue");
  const createActionHref = `/fuel-trucks?${createParams.toString()}`;
  const refillActionHref = `/fuel-trucks?${refillParams.toString()}`;
  const issueActionHref = `/fuel-trucks?${issueParams.toString()}`;
  const modalAction = String(searchParams.action ?? "");

  return (
    <AppShell>
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Fuel Tanker Management"
          subtitle="Track fuel tanker stock, refill entries, diesel issue to buses, and auditable ledger"
          icon={Fuel}
          tag="Diesel Ops"
          actions={
            <ModuleExportLauncher
              moduleKey="fuel-trucks"
              moduleLabel="Fuel Tankers"
              basePath="/fuel-trucks"
              searchParams={{
                q: searchParams.q,
                status: searchParams.status,
                from: searchParams.fromDate,
                to: searchParams.toDate,
                export: searchParams.export,
                action: searchParams.action,
                fuelTruckId: searchParams.fuelTruckId,
                busId: searchParams.busId,
                fuelStation: searchParams.fuelStation,
                driver: searchParams.driver,
                page: searchParams.page,
                pageSize: searchParams.pageSize,
              }}
              defaultQuery={searchParams.q ?? ""}
              defaultStatus={searchParams.status ?? ""}
            />
          }
        />

        {searchParams.created ? (
          <StatusAlert tone="success" message="Fuel tanker created successfully." />
        ) : null}
        {searchParams.refilled ? (
          <StatusAlert tone="success" message="Fuel tanker refill recorded and stock updated." />
        ) : null}
        {searchParams.issued ? (
          <StatusAlert tone="info" message="Diesel issue to bus recorded and stock updated." />
        ) : null}
        {searchParams.refillDeleted ? (
          <StatusAlert tone="warning" message="Refill report entry deleted successfully." />
        ) : null}
        {searchParams.issueDeleted ? (
          <StatusAlert tone="warning" message="Issue report entry deleted successfully." />
        ) : null}
        {searchParams.error ? (
          <StatusAlert tone="error" message={safeDecodeURIComponent(searchParams.error)} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Fuel Trucks</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{summary.truckStocks.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Refilled Today (L)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{summary.today.refilledLiters.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Issued Today (L)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{summary.today.issuedLiters.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{summary.lowStock.length}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fuel Tanker Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href={createActionHref} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Create Fuel Tanker
            </Link>
            <Link href={refillActionHref} className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">
              Fuel Tanker Refill History
            </Link>
            <Link href={issueActionHref} className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">
              Diesel Issue to Bus
            </Link>
          </CardContent>
        </Card>

        {modalAction === "create" ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
            <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Create Fuel Tanker</CardTitle>
                  <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Close
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form action={createFuelTruck} className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Identity</p>
                  <Label htmlFor="truckCode">Truck Code</Label>
                  <Input id="truckCode" name="truckCode" required />
                  <Label htmlFor="truckName">Truck Name</Label>
                  <Input id="truckName" name="truckName" required />
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input id="registrationNumber" name="registrationNumber" required />
                  <p className="pt-2 text-xs font-medium text-muted-foreground uppercase">Stock Controls</p>
                  <Label htmlFor="tankCapacityLiters">Tank Capacity (L)</Label>
                  <Input id="tankCapacityLiters" name="tankCapacityLiters" type="number" step="0.01" required />
                  <Label htmlFor="currentAvailableLiters">Current Available (L)</Label>
                  <Input id="currentAvailableLiters" name="currentAvailableLiters" type="number" step="0.01" defaultValue="0" required />
                  <Label htmlFor="lowStockThresholdLiters">Low Stock Threshold (L)</Label>
                  <Input id="lowStockThresholdLiters" name="lowStockThresholdLiters" type="number" step="0.01" defaultValue="0" required />
                  <Label htmlFor="status">Status</Label>
                  <select id="status" name="status" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="active">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" />
                  <Button type="submit">Create Fuel Tanker</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {modalAction === "refill" ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
            <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Fuel Tanker Refill Entry</CardTitle>
                  <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Close
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form action={addRefill} className="grid gap-2">
                  <Label htmlFor="fuelTruckIdRefill">Fuel Tanker</Label>
                  <select id="fuelTruckIdRefill" name="fuelTruckId" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" required>
                    <option value="">Select truck</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truckCode} - {truck.truckName}
                      </option>
                    ))}
                  </select>
                  <Label htmlFor="refillDate">Date</Label>
                  <Input id="refillDate" name="refillDate" type="date" defaultValue={defaultDate} required />
                  <Label htmlFor="refillTime">Time</Label>
                  <Input id="refillTime" name="refillTime" type="time" defaultValue={defaultTime} required />
                  <Label htmlFor="odometerReading">Odometer Reading</Label>
                  <Input id="odometerReading" name="odometerReading" type="number" step="0.01" />
                  <Label htmlFor="fuelStationName">Fuel Station</Label>
                  <Input id="fuelStationName" name="fuelStationName" required />
                  <Label htmlFor="vendorName">Vendor / Company</Label>
                  <Input id="vendorName" name="vendorName" />
                  <RefillAmountFields
                    quantityId="quantityLiters"
                    quantityName="quantityLiters"
                    rateId="ratePerLiter"
                    rateName="ratePerLiter"
                    totalId="totalAmount"
                    totalName="totalAmount"
                  />
                  <Label htmlFor="billNumber">Bill Number</Label>
                  <Input id="billNumber" name="billNumber" />
                  <Label htmlFor="paymentMode">Payment Mode</Label>
                  <Input id="paymentMode" name="paymentMode" placeholder="cash/card/upi" />
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input id="driverName" name="driverName" />
                  <Label htmlFor="notesRefill">Notes</Label>
                  <Input id="notesRefill" name="notes" />
                  <Label htmlFor="receipt">Receipt (optional)</Label>
                  <Input id="receipt" name="receipt" type="file" />
                  <Button type="submit">Save Refill</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {modalAction === "issue" ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
            <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Diesel Issue to Bus</CardTitle>
                  <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Close
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form action={addIssue} className="grid gap-2">
                  <Label htmlFor="fuelTruckIdIssue">Fuel Tanker</Label>
                  <select id="fuelTruckIdIssue" name="fuelTruckId" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" required>
                    <option value="">Select truck</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truckCode} - {truck.truckName}
                      </option>
                    ))}
                  </select>
                  <Label htmlFor="busId">Bus</Label>
                  <BusSearchSelect
                    id="busId"
                    name="busId"
                    required
                    buses={buses.rows.map((bus) => ({
                      id: bus.id,
                      busNumber: bus.bus_number,
                      registrationNumber: bus.registration_number,
                      latestOdometerKm: bus.odometer_km != null ? Number(bus.odometer_km) : null,
                    }))}
                    oldOdometerTargetId="odometerBeforeKm"
                  />
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input id="issueDate" name="issueDate" type="date" defaultValue={defaultDate} required />
                  <Label htmlFor="issueTime">Issue Time</Label>
                  <Input id="issueTime" name="issueTime" type="time" defaultValue={defaultTime} required />
                  <Label htmlFor="litersIssued">Liters Issued</Label>
                  <Input id="litersIssued" name="litersIssued" type="number" step="0.01" required />
                  <Label htmlFor="odometerBeforeKm">Old Odometer (km)</Label>
                  <Input id="odometerBeforeKm" name="odometerBeforeKm" type="number" step="0.01" min="0" />
                  <Label htmlFor="odometerAfterKm">New Odometer (km)</Label>
                  <Input id="odometerAfterKm" name="odometerAfterKm" type="number" step="0.01" min="0" />
                  <p className="text-xs text-muted-foreground">
                    If odometer is not available now, leave blank. Mileage will show as N/A until updated.
                  </p>
                  <Label htmlFor="issuedByName">Issued By</Label>
                  <Input id="issuedByName" name="issuedByName" />
                  <Label htmlFor="busDriverName">Bus Driver / Operator</Label>
                  <Input id="busDriverName" name="busDriverName" />
                  <Label htmlFor="routeReference">Route / Trip Reference</Label>
                  <Input id="routeReference" name="routeReference" />
                  <Label htmlFor="remarksIssue">Remarks</Label>
                  <Input id="remarksIssue" name="remarks" />
                  <Button type="submit">Save Issue</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Fuel Tanker List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-4">
              <Input name="q" placeholder="Search code/name/registration" defaultValue={searchParams.q ?? ""} />
              <select name="status" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue={searchParams.status ?? ""}>
                <option value="">All status</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <Button type="submit">Apply Filters</Button>
              <Link href="/fuel-trucks" className="inline-flex h-10 items-center rounded-md border px-3 text-sm">
                Clear
              </Link>
            </form>
            {activeFilters.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {activeFilters.map((value) => (
                  <span key={value} className="rounded-full border bg-muted px-2 py-1">
                    {value}
                  </span>
                ))}
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Capacity (L)</TableHead>
                  <TableHead>Available (L)</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTrucks.map((truck) => (
                  <TableRow key={truck.id}>
                    <TableCell>{truck.truckCode}</TableCell>
                    <TableCell>{truck.truckName}</TableCell>
                    <TableCell>{truck.registrationNumber}</TableCell>
                    <TableCell>{truck.tankCapacityLiters.toFixed(2)}</TableCell>
                    <TableCell>{truck.currentAvailableLiters.toFixed(2)}</TableCell>
                    <TableCell>{truck.lowStockThresholdLiters.toFixed(2)}</TableCell>
                    <TableCell>{truck.status}</TableCell>
                    <TableCell className="text-right">
                      <Link className="text-blue-600 hover:underline" href={`/fuel-trucks/${truck.id}`}>
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleTrucks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No fuel tankers found. Adjust filters or create a new tanker.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Showing {totalTrucks === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, totalTrucks)} of {totalTrucks}
              </span>
              <div className="flex items-center gap-2">
                <form className="flex items-center gap-2">
                  <input type="hidden" name="q" value={searchParams.q ?? ""} />
                  <input type="hidden" name="status" value={searchParams.status ?? ""} />
                  <input type="hidden" name="page" value="1" />
                  <select
                    name="pageSize"
                    defaultValue={String(pageSize)}
                    className="h-8 rounded border border-input bg-transparent px-2 text-xs"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    Per Page
                  </Button>
                </form>
                <Link
                  className={`rounded border px-2 py-1 ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  href={`/fuel-trucks?q=${encodeURIComponent(searchParams.q ?? "")}&status=${encodeURIComponent(searchParams.status ?? "")}&pageSize=${pageSize}&page=${Math.max(1, currentPage - 1)}`}
                >
                  Prev
                </Link>
                <span>
                  {currentPage}/{totalPages}
                </span>
                <Link
                  className={`rounded border px-2 py-1 ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  href={`/fuel-trucks?q=${encodeURIComponent(searchParams.q ?? "")}&status=${encodeURIComponent(searchParams.status ?? "")}&pageSize=${pageSize}&page=${Math.min(totalPages, currentPage + 1)}`}
                >
                  Next
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports & Ledger Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-7">
              <Input name="fromDate" type="date" defaultValue={searchParams.fromDate ?? ""} />
              <Input name="toDate" type="date" defaultValue={searchParams.toDate ?? ""} />
              <select name="fuelTruckId" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue={searchParams.fuelTruckId ?? ""}>
                <option value="">All fuel tankers</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.truckCode}
                  </option>
                ))}
              </select>
              <select name="busId" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue={searchParams.busId ?? ""}>
                <option value="">All buses</option>
                {buses.rows.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.registration_number} - {bus.bus_number}
                  </option>
                ))}
              </select>
              <Input name="fuelStation" placeholder="Fuel station" defaultValue={searchParams.fuelStation ?? ""} />
              <Input name="driver" placeholder="Driver name" defaultValue={searchParams.driver ?? ""} />
              <Button type="submit">Run</Button>
            </form>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Refill Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Truck</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead className="text-right">Liters</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.refillReport.slice(0, 20).map((row, idx) => (
                        <TableRow key={`${row.truck_code}-${idx}`}>
                          <TableCell>{row.refill_date}</TableCell>
                          <TableCell>{row.truck_code}</TableCell>
                          <TableCell>{row.fuel_station_name ?? "-"}</TableCell>
                          <TableCell className="text-right">{Number(row.quantity_liters).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <form action={deleteRefillReportEntry}>
                              <input type="hidden" name="refillId" value={row.id} />
                              <ConfirmSubmitButton
                                label="Delete"
                                message="Delete this refill report entry?"
                                className="text-red-600 hover:underline"
                              />
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reports.refillReport.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No refill records for current filters.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Issue Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Truck</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead className="text-right">Liters</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.issueReport.slice(0, 20).map((row, idx) => (
                        <TableRow key={`${row.truck_code}-${idx}`}>
                          <TableCell>{row.issue_date}</TableCell>
                          <TableCell>{row.truck_code}</TableCell>
                          <TableCell>{row.registration_number ?? row.bus_number ?? "-"}</TableCell>
                          <TableCell className="text-right">{Number(row.liters_issued).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/fuel-trucks/${row.fuel_truck_id}?editIssueId=${row.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <form action={deleteIssueReportEntry}>
                                <input type="hidden" name="issueId" value={row.id} />
                                <ConfirmSubmitButton
                                  label="Delete"
                                  message="Delete this issue report entry?"
                                  className="text-red-600 hover:underline"
                                />
                              </form>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reports.issueReport.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No issue records for current filters.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

