import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { measureAsync } from "@/lib/dev-bench";
import { getUploadedFileBuffer, isUploadLikeFile } from "@/lib/document-storage";
import { formatDateInAppTimeZone, getAppDateTimeInputDefaults } from "@/lib/timezone";
import type { FuelIssue, FuelTruck, FuelTruckLedgerEntry, FuelTruckRefill } from "@/lib/types";
import { safeDecodeURIComponent } from "@/lib/url";
import { FuelTruckService } from "@/services/fuel-truck.service";
import { BusSearchSelect } from "@/components/fuel-trucks/bus-search-select";
import { RefillAmountFields } from "@/components/fuel-trucks/refill-amount-fields";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const fuelTruckService = new FuelTruckService();
const DETAIL_ENTRY_ACTIONS = new Set(["refill", "issue"]);

type FuelTruckDetailView = {
  truck: FuelTruck;
  refills: FuelTruckRefill[];
  issues: FuelIssue[];
  ledger: FuelTruckLedgerEntry[];
};

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function updateFuelTruck(formData: FormData) {
  "use server";
  await measureAsync("fuel-trucks/detail action updateFuelTruck", async () => {
    const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
    await requireModuleAccess("fuel-truck");
    const id = Number(formData.get("id"));
    if (!id) return;

    try {
      await fuelTruckService.updateFuelTruck({
        id,
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
        action: "update",
        entityType: "fuel_truck",
        entityId: id,
      });
      revalidatePath(`/fuel-trucks/${id}`);
      revalidatePath("/fuel-trucks");
      redirect(`/fuel-trucks/${id}?updated=${Date.now()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update fuel tanker";
      redirect(`/fuel-trucks/${id}?error=${encodeURIComponent(message)}`);
    }
  });
}

async function addTruckRefill(formData: FormData) {
  "use server";
  await measureAsync("fuel-trucks/detail action addTruckRefill", async () => {
    const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
    await requireModuleAccess("fuel-truck");

    const id = Number(formData.get("fuelTruckId"));
    if (!id) return;
    const receiptFile = formData.get("receipt");
    const receipt =
      isUploadLikeFile(receiptFile) && receiptFile.size > 0 ? await getUploadedFileBuffer(receiptFile) : null;

    try {
      const result = await fuelTruckService.addRefill({
      fuelTruckId: id,
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
        details: { fuelTruckId: id, quantityLiters: Number(formData.get("quantityLiters")) },
      });
      revalidatePath(`/fuel-trucks/${id}`);
      revalidatePath("/fuel-trucks");
      redirect(`/fuel-trucks/${id}?refilled=${Date.now()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save refill";
      redirect(`/fuel-trucks/${id}?error=${encodeURIComponent(message)}`);
    }
  });
}

async function addTruckIssue(formData: FormData) {
  "use server";
  await measureAsync("fuel-trucks/detail action addTruckIssue", async () => {
    const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
    await requireModuleAccess("fuel-truck");

    const id = Number(formData.get("fuelTruckId"));
    if (!id) return;
    try {
      const busId = Number(formData.get("busId"));
      if (!Number.isFinite(busId) || busId <= 0) {
        redirect(`/fuel-trucks/${id}?error=${encodeURIComponent("Please select a bus from the list before saving issue.")}`);
      }
      const result = await fuelTruckService.addIssue({
      fuelTruckId: id,
      busId,
      issueDate: String(formData.get("issueDate") ?? ""),
      issueTime: String(formData.get("issueTime") ?? ""),
      litersIssued: Number(formData.get("litersIssued")),
      odometerBeforeKm: optionalNumber(formData, "odometerBeforeKm"),
      odometerAfterKm: optionalNumber(formData, "odometerAfterKm"),
      amount: optionalNumber(formData, "amount") ?? 0,
      companyName: String(formData.get("companyName") ?? ""),
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
        details: { fuelTruckId: id, busId, litersIssued: Number(formData.get("litersIssued")) },
      });
      revalidatePath(`/fuel-trucks/${id}`);
      revalidatePath("/fuel-trucks");
      if (busId) revalidatePath(`/buses/${busId}`);
      redirect(`/fuel-trucks/${id}?issued=${Date.now()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save issue";
      redirect(`/fuel-trucks/${id}?error=${encodeURIComponent(message)}`);
    }
  });
}

async function updateTruckIssue(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
  await requireModuleAccess("fuel-truck");
  const fuelTruckId = Number(formData.get("fuelTruckId"));
  const issueId = Number(formData.get("issueId"));
  if (!fuelTruckId || !issueId) return;
  try {
    const busId = Number(formData.get("busId"));
    await fuelTruckService.updateIssue({
      issueId,
      issueDate: String(formData.get("issueDate") ?? ""),
      issueTime: String(formData.get("issueTime") ?? ""),
      litersIssued: Number(formData.get("litersIssued")),
      odometerBeforeKm: optionalNumber(formData, "odometerBeforeKm"),
      odometerAfterKm: optionalNumber(formData, "odometerAfterKm"),
      amount: optionalNumber(formData, "amount") ?? 0,
      companyName: String(formData.get("companyName") ?? ""),
      issuedByName: String(formData.get("issuedByName") ?? ""),
      busDriverName: String(formData.get("busDriverName") ?? ""),
      routeReference: String(formData.get("routeReference") ?? ""),
      remarks: String(formData.get("remarks") ?? ""),
      userId: session.id,
    });
    await logAuditEvent({
      session,
      action: "update",
      entityType: "fuel_truck_issue",
      entityId: issueId,
      details: { fuelTruckId, busId, litersIssued: Number(formData.get("litersIssued")) },
    });
    revalidatePath(`/fuel-trucks/${fuelTruckId}`);
    revalidatePath("/fuel-trucks");
    if (busId) revalidatePath(`/buses/${busId}`);
    redirect(`/fuel-trucks/${fuelTruckId}?issueUpdated=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update issue";
    redirect(`/fuel-trucks/${fuelTruckId}?error=${encodeURIComponent(message)}`);
  }
}

async function deleteTruckIssue(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
  await requireModuleAccess("fuel-truck");
  const fuelTruckId = Number(formData.get("fuelTruckId"));
  const issueId = Number(formData.get("issueId"));
  if (!fuelTruckId || !issueId) return;

  try {
    const result = await fuelTruckService.deleteIssue(issueId, session.id);
    await logAuditEvent({
      session,
      action: "delete",
      entityType: "fuel_truck_issue",
      entityId: issueId,
      details: { fuelTruckId: result.fuelTruckId, busId: result.busId },
    });
    revalidatePath(`/fuel-trucks/${fuelTruckId}`);
    revalidatePath("/fuel-trucks");
    revalidatePath("/dashboard");
    if (result.busId) revalidatePath(`/buses/${result.busId}`);
    redirect(`/fuel-trucks/${fuelTruckId}?issueDeleted=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete issue";
    redirect(`/fuel-trucks/${fuelTruckId}?error=${encodeURIComponent(message)}`);
  }
}

async function deleteLedgerTransaction(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager", "updater"]);
  await requireModuleAccess("fuel-truck");
  const fuelTruckId = Number(formData.get("fuelTruckId"));
  const ledgerId = Number(formData.get("ledgerId"));
  if (!fuelTruckId || !ledgerId) return;

  try {
    const result = await fuelTruckService.deleteLedgerTransaction(ledgerId, session.id);
    await logAuditEvent({
      session,
      action: "delete",
      entityType: result.deletedType === "ISSUE" ? "fuel_truck_issue" : "fuel_truck_refill",
      entityId: result.referenceId,
      details: { fuelTruckId: result.fuelTruckId, busId: result.busId, source: "stock_ledger" },
    });
    revalidatePath(`/fuel-trucks/${fuelTruckId}`);
    revalidatePath("/fuel-trucks");
    revalidatePath("/dashboard");
    if (result.busId) revalidatePath(`/buses/${result.busId}`);
    redirect(`/fuel-trucks/${fuelTruckId}?ledgerDeleted=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete ledger transaction";
    redirect(`/fuel-trucks/${fuelTruckId}?error=${encodeURIComponent(message)}`);
  }
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    updated?: string;
    refilled?: string;
    issued?: string;
    issueUpdated?: string;
    issueDeleted?: string;
    ledgerDeleted?: string;
    editIssueId?: string;
    action?: string;
    error?: string;
  }>;
};

export default async function FuelTruckDetailPage(props: Props) {
  await requireSession();
  await requireModuleAccess("fuel-truck");
  const { searchParams, detailAction, isEntryFlow, detail, buses } = await measureAsync(
    "fuel-trucks/detail total",
    async () => {
      const params = await props.params;
      const searchParams = await props.searchParams;
      const id = Number(params.id);
      if (!id) notFound();
      const detailAction = String(searchParams.action ?? "");
      const isEntryFlow = DETAIL_ENTRY_ACTIONS.has(detailAction);
      const needsBuses = !isEntryFlow || detailAction === "issue";

      const [truckData, buses] = await Promise.all([
        isEntryFlow
          ? measureAsync("fuel-trucks/detail getFuelTruck", () => fuelTruckService.getFuelTruck(id))
          : measureAsync("fuel-trucks/detail getFuelTruckDetail", () => fuelTruckService.getFuelTruckDetail(id)),
        needsBuses
          ? measureAsync("fuel-trucks/detail buses", () =>
              query<{ id: number; bus_number: string; registration_number: string; odometer_km: string | null }>(
                `SELECT id, bus_number, registration_number, odometer_km::text FROM buses WHERE status = 'active' ORDER BY bus_number`,
              ),
            )
          : Promise.resolve({ rows: [] as { id: number; bus_number: string; registration_number: string; odometer_km: string | null }[] }),
      ]);

      if (!truckData) notFound();

      const detail: FuelTruckDetailView = isEntryFlow
        ? {
            truck: truckData as FuelTruck,
            refills: [],
            issues: [],
            ledger: [],
          }
        : (truckData as FuelTruckDetailView);

      return { searchParams, detailAction, isEntryFlow, detail, buses };
    },
  );
  const editIssueId = Number(searchParams.editIssueId ?? "");
  const issueToEdit = Number.isFinite(editIssueId) && editIssueId > 0
    ? detail.issues.find((issue) => issue.id === editIssueId) ?? null
    : null;

  const { date: defaultDate, time: defaultTime } = getAppDateTimeInputDefaults();
  const refillActionHref = `/fuel-trucks/${detail.truck.id}?action=refill`;
  const issueActionHref = `/fuel-trucks/${detail.truck.id}?action=issue`;
  const baseDetailHref = `/fuel-trucks/${detail.truck.id}`;

  return (
    <AppShell>
      <div className="space-y-4">
        {searchParams.updated ? (
          <StatusAlert tone="info" message="Fuel tanker updated successfully." />
        ) : null}
        {searchParams.refilled ? (
          <StatusAlert tone="success" message="Refill saved successfully." />
        ) : null}
        {searchParams.issued ? (
          <StatusAlert tone="info" message="Issue saved successfully." />
        ) : null}
        {searchParams.issueUpdated ? (
          <StatusAlert tone="success" message="Issue updated successfully." />
        ) : null}
        {searchParams.issueDeleted ? (
          <StatusAlert tone="warning" message="Issue deleted from tanker stock and bus fuel history; stock was restored." />
        ) : null}
        {searchParams.ledgerDeleted ? (
          <StatusAlert tone="warning" message="Stock transaction deleted successfully and all linked records were synchronized." />
        ) : null}
        {searchParams.error ? (
          <StatusAlert tone="error" message={safeDecodeURIComponent(searchParams.error)} />
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {detail.truck.truckCode} - {detail.truck.truckName}
          </h2>
          <div className="flex items-center gap-3">
            <Link href={refillActionHref} className="text-sm text-blue-600 hover:underline">
              Add Refill
            </Link>
            <Link href={issueActionHref} className="text-sm text-blue-600 hover:underline">
              Add Issue
            </Link>
            <Link href="/fuel-trucks" className="text-sm text-blue-600 hover:underline">
              Back to Fuel Tankers
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Stock Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Registration: {detail.truck.registrationNumber}</p>
              <p>Tank Capacity: {detail.truck.tankCapacityLiters.toFixed(2)} L</p>
              <p>Current Stock: {detail.truck.currentAvailableLiters.toFixed(2)} L</p>
              <p>Low Threshold: {detail.truck.lowStockThresholdLiters.toFixed(2)} L</p>
              <p>Status: {detail.truck.status}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Edit Fuel Tanker</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateFuelTruck} className="grid gap-2 md:grid-cols-3">
                <input type="hidden" name="id" value={detail.truck.id} />
                <div className="grid gap-1">
                  <Label htmlFor="truckCode">Truck Code</Label>
                  <Input id="truckCode" name="truckCode" defaultValue={detail.truck.truckCode} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="truckName">Truck Name</Label>
                  <Input id="truckName" name="truckName" defaultValue={detail.truck.truckName} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input id="registrationNumber" name="registrationNumber" defaultValue={detail.truck.registrationNumber} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tankCapacityLiters">Tank Capacity (L)</Label>
                  <Input id="tankCapacityLiters" name="tankCapacityLiters" type="number" step="0.01" defaultValue={detail.truck.tankCapacityLiters} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="currentAvailableLiters">Current Stock (L)</Label>
                  <Input id="currentAvailableLiters" name="currentAvailableLiters" type="number" step="0.01" defaultValue={detail.truck.currentAvailableLiters} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="lowStockThresholdLiters">Low Threshold (L)</Label>
                  <Input id="lowStockThresholdLiters" name="lowStockThresholdLiters" type="number" step="0.01" defaultValue={detail.truck.lowStockThresholdLiters} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="status">Status</Label>
                  <select id="status" name="status" defaultValue={detail.truck.status} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <div className="grid gap-1 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" defaultValue={detail.truck.notes ?? ""} />
                </div>
                <div className="grid gap-1">
                  <Label className="invisible">Save</Label>
                  <Button type="submit">Update</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {detailAction === "refill" ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
            <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Add Refill</CardTitle>
                  <Link href={baseDetailHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Close
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form action={addTruckRefill} className="grid gap-2">
                  <input type="hidden" name="fuelTruckId" value={detail.truck.id} />
                  <Label htmlFor="refillDate">Date</Label>
                  <Input id="refillDate" name="refillDate" type="date" defaultValue={defaultDate} required />
                  <Label htmlFor="refillTime">Time</Label>
                  <Input id="refillTime" name="refillTime" type="time" defaultValue={defaultTime} required />
                  <Label htmlFor="odometerReading">Odometer</Label>
                  <Input id="odometerReading" name="odometerReading" type="number" step="0.01" />
                  <Label htmlFor="fuelStationName">Fuel Station</Label>
                  <Input id="fuelStationName" name="fuelStationName" required />
                  <Label htmlFor="vendorName">Vendor</Label>
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
                  <Input id="paymentMode" name="paymentMode" />
                  <Label htmlFor="driverName">Driver</Label>
                  <Input id="driverName" name="driverName" />
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" />
                  <Label htmlFor="receipt">Receipt</Label>
                  <Input id="receipt" name="receipt" type="file" />
                  <Button type="submit">Save Refill</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {detailAction === "issue" ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
            <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Add Issue to Bus</CardTitle>
                  <Link href={baseDetailHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Close
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form action={addTruckIssue} className="grid gap-2">
                  <input type="hidden" name="fuelTruckId" value={detail.truck.id} />
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
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" defaultValue="0" />
                  <Label htmlFor="companyName">Company</Label>
                  <Input id="companyName" name="companyName" />
                  <p className="text-xs text-muted-foreground">
                    Odometer is optional. If unavailable now, mileage will show as N/A until updated later.
                  </p>
                  <Label htmlFor="issuedByName">Issued By</Label>
                  <Input id="issuedByName" name="issuedByName" />
                  <Label htmlFor="busDriverName">Bus Driver / Operator</Label>
                  <Input id="busDriverName" name="busDriverName" />
                  <Label htmlFor="routeReference">Route / Trip Reference</Label>
                  <Input id="routeReference" name="routeReference" />
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input id="remarks" name="remarks" />
                  <Button type="submit">Save Issue</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!isEntryFlow ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Stock Ledger</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bus Registration</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {formatDateInAppTimeZone(entry.transactionDate)} {entry.transactionTime.slice(0, 5)}
                      </TableCell>
                      <TableCell>{entry.transactionType}</TableCell>
                      <TableCell>{entry.busRegistrationNumber ?? "-"}</TableCell>
                      <TableCell className="text-right">{entry.openingStock.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.quantityIn.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.quantityOut.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.closingStock.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {entry.referenceId && (entry.referenceType === "fuel_issues" || entry.referenceType === "fuel_truck_refills") ? (
                          <form action={deleteLedgerTransaction}>
                            <input type="hidden" name="fuelTruckId" value={detail.truck.id} />
                            <input type="hidden" name="ledgerId" value={entry.id} />
                            <ConfirmSubmitButton
                              label="Delete"
                              message={`Delete this ${entry.transactionType.toLowerCase()} transaction? Linked stock and ${entry.referenceType === "fuel_issues" ? "bus history" : "refill history"} records will also be updated.`}
                              className="text-red-500 hover:underline"
                            />
                          </form>
                        ) : (
                          <span className="text-xs text-muted-foreground" title="Audit-only adjustments are protected">Protected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {detail.ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No stock ledger entries yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Refills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {detail.refills.map((refill) => (
                  <div key={refill.id} className="rounded border p-2">
                    <p className="font-medium">
                      {formatDateInAppTimeZone(refill.refillDate)} {refill.refillTime.slice(0, 5)}
                    </p>
                    <p>{refill.quantityLiters.toFixed(2)} L @ {refill.ratePerLiter.toFixed(2)}</p>
                    <p>{refill.fuelStationName ?? "-"}</p>
                    {refill.receiptFileName ? (
                      <Link className="text-blue-600 hover:underline" href={`/api/fuel-trucks/refills/${refill.id}/receipt`} target="_blank">
                        View Receipt
                      </Link>
                    ) : null}
                  </div>
                ))}
                {detail.refills.length === 0 ? (
                  <p className="text-muted-foreground">No refill records yet.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!isEntryFlow ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {issueToEdit ? (
                <form action={updateTruckIssue} className="mb-4 grid gap-2 rounded-md border p-3">
                <input type="hidden" name="fuelTruckId" value={detail.truck.id} />
                <input type="hidden" name="issueId" value={issueToEdit.id} />
                <input type="hidden" name="busId" value={issueToEdit.busId} />
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="editIssueDate">Issue Date</Label>
                    <Input id="editIssueDate" name="issueDate" type="date" defaultValue={issueToEdit.issueDate} required />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editIssueTime">Issue Time</Label>
                    <Input id="editIssueTime" name="issueTime" type="time" defaultValue={issueToEdit.issueTime.slice(0, 5)} required />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editLitersIssued">Liters Issued</Label>
                    <Input id="editLitersIssued" name="litersIssued" type="number" step="0.01" defaultValue={issueToEdit.litersIssued} required />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editAmount">Amount</Label>
                    <Input id="editAmount" name="amount" type="number" step="0.01" defaultValue={issueToEdit.amount} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editOdometerBefore">Old Odometer (km)</Label>
                    <Input id="editOdometerBefore" name="odometerBeforeKm" type="number" step="0.01" defaultValue={issueToEdit.odometerBeforeKm ?? ""} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editOdometerAfter">New Odometer (km)</Label>
                    <Input id="editOdometerAfter" name="odometerAfterKm" type="number" step="0.01" defaultValue={issueToEdit.odometerAfterKm ?? ""} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editCompanyName">Company</Label>
                    <Input id="editCompanyName" name="companyName" defaultValue={issueToEdit.companyName ?? ""} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editIssuedByName">Issued By</Label>
                    <Input id="editIssuedByName" name="issuedByName" defaultValue={issueToEdit.issuedByName ?? ""} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editBusDriverName">Bus Driver / Operator</Label>
                    <Input id="editBusDriverName" name="busDriverName" defaultValue={issueToEdit.busDriverName ?? ""} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="editRouteReference">Route / Trip Reference</Label>
                    <Input id="editRouteReference" name="routeReference" defaultValue={issueToEdit.routeReference ?? ""} />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="editRemarks">Remarks</Label>
                  <Input id="editRemarks" name="remarks" defaultValue={issueToEdit.remarks ?? ""} />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit">Update Issue</Button>
                  <Link href={`/fuel-trucks/${detail.truck.id}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                    Cancel
                  </Link>
                </div>
                </form>
              ) : null}
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Old Odo</TableHead>
                  <TableHead>New Odo</TableHead>
                  <TableHead className="text-right">Liters</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route Ref</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>{formatDateInAppTimeZone(issue.issueDate)} {issue.issueTime.slice(0, 5)}</TableCell>
                    <TableCell>{issue.busNumber ?? issue.busId}</TableCell>
                    <TableCell>{issue.odometerBeforeKm != null ? issue.odometerBeforeKm.toFixed(2) : "-"}</TableCell>
                    <TableCell>{issue.odometerAfterKm != null ? issue.odometerAfterKm.toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-right">{issue.litersIssued.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{issue.amount.toFixed(2)}</TableCell>
                    <TableCell>{issue.companyName ?? "-"}</TableCell>
                    <TableCell>{issue.issuedByName ?? "-"}</TableCell>
                    <TableCell>{issue.busDriverName ?? "-"}</TableCell>
                    <TableCell>{issue.routeReference ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/fuel-trucks/${detail.truck.id}?editIssueId=${issue.id}`} className="text-blue-600 hover:underline">
                          Edit
                        </Link>
                        <form action={deleteTruckIssue}>
                          <input type="hidden" name="fuelTruckId" value={detail.truck.id} />
                          <input type="hidden" name="issueId" value={issue.id} />
                          <ConfirmSubmitButton
                            label="Delete"
                            message={`Delete this ${issue.litersIssued.toFixed(2)} L issue? Tanker stock will be restored and the entry will be removed from bus ${issue.registrationNumber ?? issue.busNumber ?? issue.busId} history.`}
                            className="text-red-500 hover:underline"
                          />
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {detail.issues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      No issue records yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

