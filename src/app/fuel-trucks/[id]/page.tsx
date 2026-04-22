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
import { getUploadedFileBuffer } from "@/lib/document-storage";
import { safeDecodeURIComponent } from "@/lib/url";
import { FuelTruckService } from "@/services/fuel-truck.service";
import { BusSearchSelect } from "@/components/fuel-trucks/bus-search-select";
import { RefillAmountFields } from "@/components/fuel-trucks/refill-amount-fields";

const fuelTruckService = new FuelTruckService();

async function updateFuelTruck(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
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
}

async function addTruckRefill(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");

  const id = Number(formData.get("fuelTruckId"));
  if (!id) return;
  const receiptFile = formData.get("receipt");
  const receipt =
    receiptFile instanceof File && receiptFile.size > 0 ? await getUploadedFileBuffer(receiptFile) : null;

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
}

async function addTruckIssue(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "fuel_manager"]);
  await requireModuleAccess("fuel-truck");

  const id = Number(formData.get("fuelTruckId"));
  if (!id) return;
  try {
    const busId = Number(formData.get("busId"));
    const result = await fuelTruckService.addIssue({
    fuelTruckId: id,
    busId,
    issueDate: String(formData.get("issueDate") ?? ""),
    issueTime: String(formData.get("issueTime") ?? ""),
    litersIssued: Number(formData.get("litersIssued")),
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
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; refilled?: string; issued?: string; error?: string }>;
};

export default async function FuelTruckDetailPage(props: Props) {
  await requireSession();
  await requireModuleAccess("fuel-truck");

  const params = await props.params;
  const searchParams = await props.searchParams;
  const id = Number(params.id);
  if (!id) notFound();

  const [detail, buses] = await Promise.all([
    fuelTruckService.getFuelTruckDetail(id),
    query<{ id: number; bus_number: string; registration_number: string }>(
      `SELECT id, bus_number, registration_number FROM buses WHERE status = 'active' ORDER BY bus_number`,
    ),
  ]);
  if (!detail) notFound();

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);

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
        {searchParams.error ? (
          <StatusAlert tone="error" message={safeDecodeURIComponent(searchParams.error)} />
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {detail.truck.truckCode} - {detail.truck.truckName}
          </h2>
          <Link href="/fuel-trucks" className="text-sm text-blue-600 hover:underline">
            Back to Fuel Tankers
          </Link>
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add Refill</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Add Issue to Bus</CardTitle>
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
                  }))}
                />
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input id="issueDate" name="issueDate" type="date" defaultValue={defaultDate} required />
                <Label htmlFor="issueTime">Issue Time</Label>
                <Input id="issueTime" name="issueTime" type="time" defaultValue={defaultTime} required />
                <Label htmlFor="litersIssued">Liters Issued</Label>
                <Input id="litersIssued" name="litersIssued" type="number" step="0.01" required />
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
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.transactionDate} {entry.transactionTime.slice(0, 5)}
                      </TableCell>
                      <TableCell>{entry.transactionType}</TableCell>
                      <TableCell className="text-right">{entry.openingStock.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.quantityIn.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.quantityOut.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.closingStock.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {detail.ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                    {refill.refillDate} {refill.refillTime.slice(0, 5)}
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

        <Card>
          <CardHeader>
            <CardTitle>Recent Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead className="text-right">Liters</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>{issue.issueDate} {issue.issueTime.slice(0, 5)}</TableCell>
                    <TableCell>{issue.busNumber ?? issue.busId}</TableCell>
                    <TableCell className="text-right">{issue.litersIssued.toFixed(2)}</TableCell>
                    <TableCell>{issue.issuedByName ?? "-"}</TableCell>
                    <TableCell>{issue.busDriverName ?? "-"}</TableCell>
                    <TableCell>{issue.routeReference ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {detail.issues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No issue records yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

