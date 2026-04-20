import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fuel } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { safeDecodeURIComponent } from "@/lib/url";
import { FuelService } from "@/services/fuel.service";

const fuelService = new FuelService();

async function submitFuel(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "fuel_manager", "dispatcher"]);
  await requireModuleAccess("fuel-entry");
  try {
    const registrationNumber = String(formData.get("registrationNumber") ?? "").trim();
    const driverName = String(formData.get("driverName") ?? "").trim();
    if (!registrationNumber) {
      throw new Error("Please select a bus registration number.");
    }

    const busResult = await query<{ id: number }>(
      `SELECT id
       FROM buses
       WHERE lower(registration_number) = lower($1)
       LIMIT 1`,
      [registrationNumber],
    );
    const busId = busResult.rows[0]?.id;
    if (!busId) {
      throw new Error("Selected bus registration number was not found.");
    }

    let driverId: number | null = null;
    if (driverName) {
      const driverResult = await query<{ id: number }>(
        `SELECT id
         FROM drivers
         WHERE lower(full_name) = lower($1) AND is_active = true
         ORDER BY id DESC
         LIMIT 2`,
        [driverName],
      );
      if (driverResult.rows.length === 0) {
        throw new Error("Selected driver name was not found.");
      }
      if (driverResult.rows.length > 1) {
        throw new Error("Multiple drivers found with same name. Please choose a unique driver.");
      }
      driverId = driverResult.rows[0].id;
    }

    await fuelService.addFuelEntry({
      busId,
      driverId,
      odometerBeforeKm: Number(formData.get("odometerBeforeKm")),
      odometerAfterKm: Number(formData.get("odometerAfterKm")),
      liters: Number(formData.get("liters")),
      amount: Number(formData.get("amount")),
      fuelStation: String(formData.get("fuelStation") ?? ""),
    });
    await logAuditEvent({
      session,
      action: "create",
      entityType: "fuel_entry",
      details: { busId, driverId, liters: Number(formData.get("liters")) },
    });
    revalidatePath("/dashboard");
    redirect(`/fuel-entry?saved=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save fuel entry";
    redirect(`/fuel-entry?error=${encodeURIComponent(message)}`);
  }
}

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function FuelEntryPage(props: Props) {
  await requireSession(["admin", "fuel_manager", "dispatcher"]);
  await requireModuleAccess("fuel-entry");
  const searchParams = await props.searchParams;
  const [buses, drivers] = await Promise.all([
    query<{ registration_number: string }>(
      `SELECT registration_number
       FROM buses
       WHERE status = 'active'
       ORDER BY registration_number`,
    ),
    query<{ full_name: string }>(
      `SELECT DISTINCT full_name
       FROM drivers
       WHERE is_active = true
       ORDER BY full_name`,
    ),
  ]);

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Diesel Entry"
        subtitle="Capture fuel transactions and mileage metrics"
        icon={Fuel}
        tag="Fuel Ops"
      />
      {searchParams.saved ? (
        <div className="mb-4 max-w-2xl rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Fuel entry saved successfully.
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="mb-4 max-w-2xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {safeDecodeURIComponent(searchParams.error)}
        </div>
      ) : null}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Diesel Entry and Mileage Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitFuel} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="registrationNumber">Bus Registration Number</Label>
              <Input
                id="registrationNumber"
                name="registrationNumber"
                list="bus-registration-options"
                placeholder="Search registration number and select"
                required
              />
              <datalist id="bus-registration-options">
                {buses.rows.map((bus) => (
                  <option key={bus.registration_number} value={bus.registration_number} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driverName">Driver Name</Label>
              <Input
                id="driverName"
                name="driverName"
                list="driver-name-options"
                placeholder="Search driver name and select"
              />
              <datalist id="driver-name-options">
                {drivers.rows.map((driver) => (
                  <option key={driver.full_name} value={driver.full_name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="odometerBeforeKm">Odometer Before (km)</Label>
              <Input id="odometerBeforeKm" name="odometerBeforeKm" type="number" step="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="odometerAfterKm">Odometer After (km)</Label>
              <Input id="odometerAfterKm" name="odometerAfterKm" type="number" step="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="liters">Diesel (liters)</Label>
              <Input id="liters" name="liters" type="number" step="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fuelStation">Fuel Station</Label>
              <Input id="fuelStation" name="fuelStation" />
            </div>
            <Button type="submit">Save Entry</Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
