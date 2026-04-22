import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Route } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { safeDecodeURIComponent } from "@/lib/url";

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;
const SHIFT_OPTIONS = ["general", "morning", "afternoon", "night", "unknown"] as const;
type Shift = (typeof SHIFT_OPTIONS)[number];

type RoutePlannerRow = {
  id: number;
  bus_id: number;
  driver_id: number;
  assignment_date: string;
  bus_registration_number: string;
  driver_name: string;
  company_name: string | null;
  route_name: string;
  shift: Shift;
  updated_at: string;
};

function normalizeShift(value: string): Shift {
  const normalized = value.trim().toLowerCase() as Shift;
  return SHIFT_OPTIONS.includes(normalized) ? normalized : "general";
}

async function getActiveBus(busId: number) {
  const result = await query<{ id: number }>(
    `SELECT id
     FROM buses
     WHERE id = $1 AND status = 'active'
     LIMIT 1`,
    [busId],
  );
  return result.rows[0] ?? null;
}

async function getActiveDriver(driverId: number) {
  const result = await query<{ full_name: string; company_name: string | null }>(
    `SELECT full_name, company_name
     FROM drivers
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [driverId],
  );
  return result.rows[0] ?? null;
}

async function createRouteEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("routes");
  await ensureTransportEnhancements();

  const busId = Number(formData.get("busId"));
  const driverId = Number(formData.get("driverId"));
  const routeName = String(formData.get("routeName") ?? "").trim();
  const assignmentDate = String(formData.get("assignmentDate") ?? "").trim();
  const shift = normalizeShift(String(formData.get("shift") ?? ""));
  const companyFromForm = String(formData.get("companyName") ?? "").trim();

  if (!busId || !driverId || !routeName || !assignmentDate) {
    redirect("/routes?error=Please fill all required fields.");
  }

  const bus = await getActiveBus(busId);
  if (!bus) redirect("/routes?error=Selected bus is not active.");

  const driver = await getActiveDriver(driverId);
  if (!driver) redirect("/routes?error=Selected driver is not active.");

  const companyName = companyFromForm || driver.company_name || "Unknown";
  const result = await query<{ id: number }>(
    `INSERT INTO route_planner_entries(
      bus_id, driver_id, company_name, route_name, shift, assignment_date, created_by, updated_by
    )
     VALUES($1,$2,$3,$4,$5,$6,$7,$7)
     RETURNING id`,
    [busId, driverId, companyName, routeName, shift, assignmentDate, session.id],
  );

  await logAuditEvent({
    session,
    action: "create",
    entityType: "route_plan",
    entityId: result.rows[0].id,
    details: { busId, driverId, companyName, routeName, shift, assignmentDate },
  });

  revalidatePath("/routes");
  redirect(`/routes?created=${Date.now()}`);
}

async function updateRouteEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("routes");
  await ensureTransportEnhancements();

  const routeId = Number(formData.get("routeId"));
  const busId = Number(formData.get("busId"));
  const driverId = Number(formData.get("driverId"));
  const routeName = String(formData.get("routeName") ?? "").trim();
  const assignmentDate = String(formData.get("assignmentDate") ?? "").trim();
  const shift = normalizeShift(String(formData.get("shift") ?? ""));
  const companyFromForm = String(formData.get("companyName") ?? "").trim();

  if (!routeId || !busId || !driverId || !routeName || !assignmentDate) {
    redirect("/routes?error=Please fill all required fields.");
  }

  const bus = await getActiveBus(busId);
  if (!bus) redirect("/routes?error=Selected bus is not active.");

  const driver = await getActiveDriver(driverId);
  if (!driver) redirect("/routes?error=Selected driver is not active.");

  const companyName = companyFromForm || driver.company_name || "Unknown";
  const result = await query<{ id: number }>(
    `UPDATE route_planner_entries
     SET bus_id = $1, driver_id = $2, company_name = $3, route_name = $4, shift = $5, assignment_date = $6, updated_by = $7, updated_at = NOW()
     WHERE id = $8
     RETURNING id`,
    [busId, driverId, companyName, routeName, shift, assignmentDate, session.id, routeId],
  );
  if (!result.rows[0]) {
    redirect("/routes?error=Route assignment not found.");
  }

  await logAuditEvent({
    session,
    action: "update",
    entityType: "route_plan",
    entityId: routeId,
    details: { busId, driverId, companyName, routeName, shift, assignmentDate },
  });

  revalidatePath("/routes");
  redirect(`/routes?updated=${Date.now()}`);
}

async function deleteRouteEntry(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("routes");
  await ensureTransportEnhancements();

  const routeId = Number(formData.get("routeId"));
  if (!routeId) return;

  await query(`UPDATE route_planner_entries SET is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2`, [
    session.id,
    routeId,
  ]);
  await logAuditEvent({ session, action: "delete", entityType: "route_plan", entityId: routeId });

  revalidatePath("/routes");
  redirect(`/routes?deleted=${Date.now()}`);
}

type Props = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
    q?: string;
    shift?: string;
    page?: string;
    pageSize?: string;
    editId?: string;
    create?: string;
    export?: string;
  }>;
};

export default async function RoutesPage(props: Props) {
  await requireSession();
  await requireModuleAccess("routes");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;

  const [buses, drivers, entriesResult] = await Promise.all([
    query<{ id: number; registration_number: string }>(
      `SELECT id, registration_number
       FROM buses
       WHERE status = 'active'
       ORDER BY registration_number`,
    ),
    query<{ id: number; full_name: string; company_name: string | null }>(
      `SELECT id, full_name, company_name
       FROM drivers
       WHERE is_active = true
       ORDER BY full_name`,
    ),
    query<RoutePlannerRow>(
      `SELECT rp.id, rp.bus_id, rp.driver_id, rp.assignment_date::text, rp.company_name, rp.route_name, rp.shift::text, rp.updated_at::text,
              b.registration_number AS bus_registration_number,
              d.full_name AS driver_name
       FROM route_planner_entries rp
       JOIN buses b ON b.id = rp.bus_id
       JOIN drivers d ON d.id = rp.driver_id
       WHERE rp.is_active = true
       ORDER BY rp.id DESC`,
    ),
  ]);

  const q = String(searchParams.q ?? "").trim().toLowerCase();
  const shiftParam = String(searchParams.shift ?? "").trim().toLowerCase();
  const shiftFilter = SHIFT_OPTIONS.includes(shiftParam as Shift) ? (shiftParam as Shift) : "";

  const filtered = entriesResult.rows.filter((entry) => {
    const matchesSearch =
      !q ||
      entry.bus_registration_number.toLowerCase().includes(q) ||
      entry.driver_name.toLowerCase().includes(q) ||
      (entry.company_name ?? "").toLowerCase().includes(q) ||
      entry.route_name.toLowerCase().includes(q) ||
      entry.assignment_date.includes(q);
    const matchesShift = !shiftFilter || entry.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const requestedPageSize = Number(searchParams.pageSize ?? "15");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? requestedPageSize : 15;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rawPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleEntries = filtered.slice(startIndex, startIndex + pageSize);
  const editId = Number(searchParams.editId ?? "");
  const editEntry = Number.isFinite(editId) && editId > 0
    ? entriesResult.rows.find((entry) => entry.id === editId) ?? null
    : null;
  const showCreateModal = String(searchParams.create ?? "") === "1";
  const showFormModal = showCreateModal || Boolean(editEntry);
  const queryBase = new URLSearchParams();
  if (searchParams.q) queryBase.set("q", String(searchParams.q));
  if (searchParams.shift) queryBase.set("shift", String(searchParams.shift));
  if (searchParams.pageSize) queryBase.set("pageSize", String(searchParams.pageSize));
  if (searchParams.page) queryBase.set("page", String(searchParams.page));
  const listBaseHref = `/routes${queryBase.toString() ? `?${queryBase.toString()}` : ""}`;
  const createHrefParams = new URLSearchParams(queryBase);
  createHrefParams.set("create", "1");
  const createHref = `/routes?${createHrefParams.toString()}`;

  const companies = Array.from(
    new Set(drivers.rows.map((driver) => (driver.company_name ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const activeFilters = [
    q ? `Search: ${q}` : null,
    shiftFilter ? `Shift: ${shiftFilter}` : null,
  ].filter(Boolean) as string[];

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Route Planner"
        subtitle="Bus + driver assignment per shift (duplicate-friendly by design)"
        icon={Route}
        tag="Route Design"
        actions={
          <ModuleExportLauncher
            moduleKey="routes"
            moduleLabel="Routes"
            basePath="/routes"
            searchParams={{
              q: searchParams.q,
              status: searchParams.shift,
              export: searchParams.export,
              shift: searchParams.shift,
              page: searchParams.page,
              pageSize: searchParams.pageSize,
              editId: searchParams.editId,
              create: searchParams.create,
            }}
            defaultQuery={searchParams.q ?? ""}
            defaultStatus={searchParams.shift ?? ""}
          />
        }
      />

      {searchParams.created ? <StatusAlert className="mb-4" tone="success" message="Route assignment created." /> : null}
      {searchParams.updated ? <StatusAlert className="mb-4" tone="info" message="Route assignment updated." /> : null}
      {searchParams.deleted ? <StatusAlert className="mb-4" tone="warning" message="Route assignment deleted." /> : null}
      {searchParams.error ? <StatusAlert className="mb-4" tone="error" message={safeDecodeURIComponent(searchParams.error)} /> : null}

      <Card className="border-violet-200/70 dark:border-violet-900">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Route Assignments</CardTitle>
              <Link href={createHref} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                Create Route
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-4">
              <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search bus/driver/company/route" />
              <select name="shift" defaultValue={searchParams.shift ?? ""} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">All shifts</option>
                {SHIFT_OPTIONS.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift.charAt(0).toUpperCase() + shift.slice(1)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">Apply</Button>
              <Link href={listBaseHref} className="inline-flex h-10 items-center justify-center rounded-md border border-input px-3 text-sm">
                Clear
              </Link>
            </form>

            {activeFilters.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {activeFilters.map((value) => (
                  <span key={value} className="rounded-full border bg-muted px-2 py-1 capitalize">
                    {value}
                  </span>
                ))}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus Registration No</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Route Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.bus_registration_number}</TableCell>
                    <TableCell>{entry.driver_name}</TableCell>
                    <TableCell>{entry.company_name ?? "-"}</TableCell>
                    <TableCell>{entry.route_name}</TableCell>
                    <TableCell>{new Date(entry.assignment_date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{entry.shift}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/routes?${(() => {
                            const params = new URLSearchParams(queryBase);
                            params.set("editId", String(entry.id));
                            return params.toString();
                          })()}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Edit
                        </Link>
                        <form action={deleteRouteEntry}>
                          <input type="hidden" name="routeId" value={entry.id} />
                          <ConfirmSubmitButton
                            label="Delete"
                            message="Delete this route assignment?"
                            className={buttonVariants({ variant: "destructive", size: "sm" })}
                          />
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No route assignments found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {total === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                {currentPage <= 1 ? (
                  <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none opacity-50`}>
                    Prev
                  </span>
                ) : (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/routes?q=${encodeURIComponent(searchParams.q ?? "")}&shift=${encodeURIComponent(searchParams.shift ?? "")}&pageSize=${pageSize}&page=${Math.max(1, currentPage - 1)}`}
                  >
                    Prev
                  </Link>
                )}
                <span>{currentPage}/{totalPages}</span>
                {currentPage >= totalPages ? (
                  <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none opacity-50`}>
                    Next
                  </span>
                ) : (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/routes?q=${encodeURIComponent(searchParams.q ?? "")}&shift=${encodeURIComponent(searchParams.shift ?? "")}&pageSize=${pageSize}&page=${Math.min(totalPages, currentPage + 1)}`}
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
      </Card>

      {showFormModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
          <Card className="max-h-[85vh] w-full max-w-3xl overflow-y-auto border-violet-200/70 dark:border-violet-900">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{editEntry ? "Update Route Assignment" : "Create Route Assignment"}</CardTitle>
                <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                  Close
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <form action={editEntry ? updateRouteEntry : createRouteEntry} className="grid gap-2">
                {editEntry ? <input type="hidden" name="routeId" value={editEntry.id} /> : null}

                <Label htmlFor="busId">Bus Registration No</Label>
                <select id="busId" name="busId" defaultValue={editEntry ? String(editEntry.bus_id) : ""} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="">Select bus</option>
                  {buses.rows.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.registration_number}
                    </option>
                  ))}
                </select>

                <Label htmlFor="driverId">Driver</Label>
                <select id="driverId" name="driverId" defaultValue={editEntry ? String(editEntry.driver_id) : ""} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="">Select driver</option>
                  {drivers.rows.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name}
                    </option>
                  ))}
                </select>

                <Label htmlFor="companyName">Company</Label>
                <Input id="companyName" name="companyName" list="company-list" defaultValue={editEntry?.company_name ?? ""} placeholder="Editable company name" />
                <datalist id="company-list">
                  {companies.map((company) => (
                    <option key={company} value={company} />
                  ))}
                </datalist>

                <Label htmlFor="routeName">Route Name</Label>
                <Input id="routeName" name="routeName" defaultValue={editEntry?.route_name ?? ""} required />

                <Label htmlFor="assignmentDate">Assignment Date</Label>
                <Input
                  id="assignmentDate"
                  name="assignmentDate"
                  type="date"
                  defaultValue={editEntry?.assignment_date ?? new Date().toISOString().slice(0, 10)}
                  required
                />

                <Label htmlFor="shift">Shift</Label>
                <select id="shift" name="shift" defaultValue={editEntry?.shift ?? "general"} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift.charAt(0).toUpperCase() + shift.slice(1)}
                    </option>
                  ))}
                </select>

                <Button type="submit">{editEntry ? "Update Assignment" : "Create Assignment"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
