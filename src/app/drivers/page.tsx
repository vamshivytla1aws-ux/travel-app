import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CarFront } from "lucide-react";
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
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

function withParams(
  base: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...updates };
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value.trim().length > 0) params.set(key, value);
  });
  const serialized = params.toString();
  return serialized ? `/drivers?${serialized}` : "/drivers";
}

async function createDriver(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  const phone = String(formData.get("phone"));
  const licenseNumber = String(formData.get("licenseNumber"));
  const companyName = String(formData.get("companyName"));
  const bankName = String(formData.get("bankName") ?? "");
  const bankAccountNumber = String(formData.get("bankAccountNumber") ?? "");
  const bankIfsc = String(formData.get("bankIfsc") ?? "");
  const pfAccountNumber = String(formData.get("pfAccountNumber") ?? "");
  const uanNumber = String(formData.get("uanNumber") ?? "");

  const existing = await query<{ id: number }>(
    `SELECT id
     FROM drivers
     WHERE phone = $1 OR license_number = $2
     LIMIT 1`,
    [phone, licenseNumber],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect("/drivers?error=duplicate");
  }

  const result = await query<{ id: number }>(
    `INSERT INTO drivers(
      full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number,
      license_number, license_expiry, experience_years
    )
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      String(formData.get("fullName")),
      phone,
      companyName,
      bankName || null,
      bankAccountNumber || null,
      bankIfsc || null,
      pfAccountNumber || null,
      uanNumber || null,
      licenseNumber,
      String(formData.get("licenseExpiry")),
      Number(formData.get("experienceYears")),
    ],
  );
  await logAuditEvent({ session, action: "create", entityType: "driver", entityId: result.rows[0].id, details: { phone, licenseNumber } });
  revalidatePath("/drivers");
  redirect(`/drivers?created=${Date.now()}`);
}

async function deleteDriver(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("drivers");
  const driverId = Number(formData.get("driverId"));
  if (!driverId) return;

  await query(`UPDATE drivers SET is_active = false, updated_at = NOW() WHERE id = $1`, [driverId]);
  await logAuditEvent({ session, action: "delete", entityType: "driver", entityId: driverId });
  revalidatePath("/drivers");
  redirect(`/drivers?deleted=${Date.now()}`);
}

type Props = {
  searchParams: Promise<{
    error?: string;
    created?: string;
    deleted?: string;
    q?: string;
    company?: string;
    page?: string;
    pageSize?: string;
    create?: string;
    export?: string;
  }>;
};

export default async function DriversPage(props: Props) {
  await requireSession();
  await requireModuleAccess("drivers");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;
  const drivers = await driversService.listDrivers();
  const query = (searchParams.q ?? "").trim().toLowerCase();
  const company = (searchParams.company ?? "").trim().toLowerCase();
  const requestedPageSize = Number(searchParams.pageSize ?? "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 10;

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      !query ||
      driver.fullName.toLowerCase().includes(query) ||
      driver.phone.toLowerCase().includes(query) ||
      driver.licenseNumber.toLowerCase().includes(query);
    const companyValue = (driver.companyName ?? "").trim().toLowerCase();
    const matchesCompany = !company || companyValue === company;
    return matchesSearch && matchesCompany;
  });

  const companies = Array.from(
    new Set(drivers.map((driver) => (driver.companyName ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const totalItems = filteredDrivers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const parsedPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleDrivers = filteredDrivers.slice(startIndex, startIndex + pageSize);
  const baseParams = {
    q: searchParams.q,
    company: searchParams.company,
    pageSize: String(pageSize),
  };
  const pageStart = Math.max(1, currentPage - 2);
  const pageEnd = Math.min(totalPages, currentPage + 2);
  const showCreateModal = String(searchParams.create ?? "") === "1";
  const listBaseHref = withParams(
    { q: searchParams.q, company: searchParams.company, pageSize: String(pageSize), page: searchParams.page },
    { create: undefined },
  );
  const createHref = withParams(
    { q: searchParams.q, company: searchParams.company, pageSize: String(pageSize), page: searchParams.page },
    { create: "1" },
  );

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Driver Operations"
        subtitle="Maintain licensed driver profiles and contact readiness"
        icon={CarFront}
        tag="Driver Ops"
        actions={
          <ModuleExportLauncher
            moduleKey="drivers"
            moduleLabel="Drivers"
            basePath="/drivers"
            searchParams={{
              q: searchParams.q,
              status: undefined,
              export: searchParams.export,
              company: searchParams.company,
              page: searchParams.page,
              pageSize: searchParams.pageSize,
              create: searchParams.create,
            }}
            defaultQuery={searchParams.q ?? ""}
          />
        }
      />
      {searchParams.error === "duplicate" ? (
        <StatusAlert className="mb-4" tone="error" message="Driver phone or license number already exists." />
      ) : null}
      {searchParams.created ? (
        <StatusAlert className="mb-4" tone="success" message="Driver created successfully." />
      ) : null}
      {searchParams.deleted ? (
        <StatusAlert className="mb-4" tone="warning" message="Driver deactivated successfully." />
      ) : null}
      <Card className="border-emerald-200/70 dark:border-emerald-900">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Drivers</CardTitle>
              <Link href={createHref} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                Create Driver
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <form method="get" className="mb-4 grid gap-3 rounded-md border bg-background p-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label htmlFor="q">Search Driver</Label>
                <Input
                  id="q"
                  name="q"
                  placeholder="Name, phone, or license"
                  defaultValue={searchParams.q ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <select
                  id="company"
                  name="company"
                  defaultValue={searchParams.company ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All companies</option>
                  {companies.map((companyName) => (
                    <option key={companyName} value={companyName}>
                      {companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pageSize">Items per page</Label>
                <div className="flex gap-2">
                  <select
                    id="pageSize"
                    name="pageSize"
                    defaultValue={String(pageSize)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <Button type="submit">Apply</Button>
                </div>
              </div>
              <div className="md:col-span-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, totalItems)} of{" "}
                  {totalItems} drivers
                </span>
                <Link className="text-blue-600 hover:underline" href="/drivers">
                  Clear filters
                </Link>
              </div>
            </form>
            {(query || company) ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {query ? <span className="rounded-full border bg-muted px-2 py-1">Search: {query}</span> : null}
                {company ? <span className="rounded-full border bg-muted px-2 py-1">Company: {company}</span> : null}
              </div>
            ) : null}
            <Table>
              <TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Company</TableHead><TableHead>License</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleDrivers.map((driver, index) => (
                  <TableRow key={driver.id}>
                    <TableCell>{startIndex + index + 1}</TableCell>
                    <TableCell>
                      <Link className="text-blue-600 hover:underline" href={`/drivers/${driver.id}`}>
                        {driver.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>{driver.companyName ?? "-"}</TableCell>
                    <TableCell>{driver.licenseNumber}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteDriver}>
                        <input type="hidden" name="driverId" value={driver.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          message="Are you sure you want to delete this driver?"
                          className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs text-destructive-foreground hover:opacity-90"
                        />
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No drivers found for the selected search/filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {currentPage <= 1 ? (
                  <span className={`${buttonVariants({ variant: "outline" })} pointer-events-none opacity-50`}>Previous</span>
                ) : (
                  <Link className={buttonVariants({ variant: "outline" })} href={withParams(baseParams, { page: String(Math.max(1, currentPage - 1)) })}>
                    Previous
                  </Link>
                )}
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i).map((pageNumber) => (
                    <Link
                      key={pageNumber}
                      className={buttonVariants({
                        variant: pageNumber === currentPage ? "default" : "outline",
                        size: "sm",
                      })}
                      href={withParams(baseParams, { page: String(pageNumber) })}
                    >
                      {pageNumber}
                    </Link>
                  ))}
                </div>
                {currentPage >= totalPages ? (
                  <span className={`${buttonVariants({ variant: "outline" })} pointer-events-none opacity-50`}>Next</span>
                ) : (
                  <Link className={buttonVariants({ variant: "outline" })} href={withParams(baseParams, { page: String(Math.min(totalPages, currentPage + 1)) })}>
                    Next
                  </Link>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          </CardContent>
      </Card>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
          <Card className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border-emerald-200/70 dark:border-emerald-900">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Create Driver</CardTitle>
                <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                  Close
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <form action={createDriver} className="grid gap-2">
                <Label htmlFor="fullName">Name</Label><Input id="fullName" name="fullName" required />
                <Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" required />
                <Label htmlFor="companyName">Company Name</Label><Input id="companyName" name="companyName" required />
                <Label htmlFor="licenseNumber">License</Label><Input id="licenseNumber" name="licenseNumber" required />
                <Label htmlFor="bankName">Bank Name</Label><Input id="bankName" name="bankName" />
                <Label htmlFor="bankAccountNumber">Bank Account Number</Label><Input id="bankAccountNumber" name="bankAccountNumber" />
                <Label htmlFor="bankIfsc">IFSC</Label><Input id="bankIfsc" name="bankIfsc" />
                <Label htmlFor="pfAccountNumber">PF Account</Label><Input id="pfAccountNumber" name="pfAccountNumber" />
                <Label htmlFor="uanNumber">UAN</Label><Input id="uanNumber" name="uanNumber" />
                <Label htmlFor="licenseExpiry">License Expiry</Label><Input id="licenseExpiry" name="licenseExpiry" type="date" required />
                <Label htmlFor="experienceYears">Experience (Years)</Label><Input id="experienceYears" name="experienceYears" type="number" required />
                <Button type="submit">Save</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
