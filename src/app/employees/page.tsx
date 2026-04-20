import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { EmployeesService } from "@/services/employees.service";

const employeesService = new EmployeesService();
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
  return `/employees?${params.toString()}`;
}

async function createEmployee(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("employees");
  const employeeCode = String(formData.get("employeeCode"));
  const email = String(formData.get("email") ?? "").trim() || null;
  const existing = await query<{ id: number }>(
    `SELECT id FROM employees
     WHERE employee_code = $1
        OR ($2::varchar IS NOT NULL AND email IS NOT NULL AND lower(email) = lower($2::varchar))
     LIMIT 1`,
    [employeeCode, email],
  );
  if ((existing.rowCount ?? 0) > 0) {
    redirect("/employees?error=duplicate");
  }

  const result = await query<{ id: number }>(
    `INSERT INTO employees(
      employee_code, full_name, phone, email, company_name, gender, blood_group, valid_from, valid_to,
      department, shift_start, shift_end, pickup_address, drop_address
    )
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      employeeCode,
      String(formData.get("fullName")),
      String(formData.get("phone")),
      email,
      String(formData.get("companyName")) || null,
      String(formData.get("gender")) || null,
      String(formData.get("bloodGroup")) || null,
      String(formData.get("validFrom")) || null,
      String(formData.get("validTo")) || null,
      String(formData.get("department")),
      "09:00:00",
      "18:00:00",
      String(formData.get("pickupAddress")),
      String(formData.get("dropAddress")),
    ],
  );
  await logAuditEvent({ session, action: "create", entityType: "employee", entityId: result.rows[0].id, details: { employeeCode, email } });
  revalidatePath("/employees");
  redirect(`/employees?created=${Date.now()}`);
}

async function deleteEmployee(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("employees");
  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) return;

  await query(`UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1`, [employeeId]);
  await logAuditEvent({ session, action: "delete", entityType: "employee", entityId: employeeId });
  revalidatePath("/employees");
  redirect(`/employees?deleted=${Date.now()}`);
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
  }>;
};

export default async function EmployeesPage(props: Props) {
  await requireSession();
  await requireModuleAccess("employees");
  const searchParams = await props.searchParams;
  const employees = await employeesService.listEmployees();
  const queryText = (searchParams.q ?? "").trim().toLowerCase();
  const company = (searchParams.company ?? "").trim().toLowerCase();
  const requestedPageSize = Number(searchParams.pageSize ?? "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 10;

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      !queryText ||
      employee.fullName.toLowerCase().includes(queryText) ||
      employee.employeeCode.toLowerCase().includes(queryText) ||
      (employee.phone ?? "").toLowerCase().includes(queryText) ||
      employee.department.toLowerCase().includes(queryText);
    const companyValue = (employee.companyName ?? "").trim().toLowerCase();
    const matchesCompany = !company || companyValue === company;
    return matchesSearch && matchesCompany;
  });

  const companies = Array.from(
    new Set(employees.map((employee) => (employee.companyName ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const totalItems = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const parsedPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);
  const baseParams = {
    q: searchParams.q,
    company: searchParams.company,
    pageSize: String(pageSize),
  };
  const pageStart = Math.max(1, currentPage - 2);
  const pageEnd = Math.min(totalPages, currentPage + 2);

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Employee Transport Roster"
        subtitle="Manage employee pickup/drop assignments and department coverage"
        icon={Users}
        tag="Workforce"
      />
      {searchParams.error === "duplicate" ? (
        <StatusAlert className="mb-4" tone="error" message="Employee code or email already exists." />
      ) : null}
      {searchParams.created ? (
        <StatusAlert className="mb-4" tone="success" message="Employee created successfully." />
      ) : null}
      {searchParams.deleted ? (
        <StatusAlert className="mb-4" tone="warning" message="Employee deactivated successfully." />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader><CardTitle>Create Employee</CardTitle></CardHeader>
          <CardContent>
            <form action={createEmployee} className="grid gap-2">
              <Label htmlFor="employeeCode">Code</Label><Input id="employeeCode" name="employeeCode" required />
              <Label htmlFor="fullName">Name</Label><Input id="fullName" name="fullName" required />
              <Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" required />
              <Label htmlFor="email">Email (optional)</Label><Input id="email" name="email" type="email" />
              <Label htmlFor="companyName">Company Name</Label><Input id="companyName" name="companyName" required />
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" name="gender" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" required>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <Label htmlFor="bloodGroup">Blood Group</Label><Input id="bloodGroup" name="bloodGroup" placeholder="B+" />
              <Label htmlFor="validFrom">Valid From</Label><Input id="validFrom" name="validFrom" type="date" />
              <Label htmlFor="validTo">Valid To / Expiry</Label><Input id="validTo" name="validTo" type="date" />
              <Label htmlFor="department">Department</Label><Input id="department" name="department" required />
              <Label htmlFor="pickupAddress">Pickup Address</Label><Input id="pickupAddress" name="pickupAddress" required />
              <Label htmlFor="dropAddress">Drop Address</Label><Input id="dropAddress" name="dropAddress" required />
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 border-blue-200/70 dark:border-blue-900">
          <CardHeader><CardTitle>Employees</CardTitle></CardHeader>
          <CardContent>
            <form method="get" className="sticky top-20 z-10 mb-4 grid gap-3 rounded-md border bg-background/95 p-3 backdrop-blur md:grid-cols-4">
              <div className="md:col-span-2">
                <Label htmlFor="q">Search Employee</Label>
                <Input
                  id="q"
                  name="q"
                  placeholder="Name, code, phone, or department"
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
                  {totalItems} employees
                </span>
                <Link className="text-blue-600 hover:underline" href="/employees">
                  Clear filters
                </Link>
              </div>
            </form>
            {(queryText || company) ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {queryText ? <span className="rounded-full border bg-muted px-2 py-1">Search: {queryText}</span> : null}
                {company ? <span className="rounded-full border bg-muted px-2 py-1">Company: {company}</span> : null}
              </div>
            ) : null}
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead>S.No</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Phone</TableHead><TableHead>Company</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleEmployees.map((employee, index) => (
                  <TableRow key={employee.id}>
                    <TableCell>{startIndex + index + 1}</TableCell>
                    <TableCell>{employee.employeeCode}</TableCell>
                    <TableCell>
                      <Link className="text-blue-600 hover:underline" href={`/employees/${employee.id}`}>
                        {employee.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.phone ?? "-"}</TableCell>
                    <TableCell>{employee.companyName ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteEmployee}>
                        <input type="hidden" name="employeeId" value={employee.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          message="Are you sure you want to delete this employee?"
                          className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs text-destructive-foreground hover:opacity-90"
                        />
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No employees found for the selected search/filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {currentPage <= 1 ? (
                  <span className="inline-flex h-8 items-center rounded-md border px-3 text-sm opacity-50">Previous</span>
                ) : (
                  <Link
                    className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
                    href={withParams(baseParams, { page: String(Math.max(1, currentPage - 1)) })}
                  >
                    Previous
                  </Link>
                )}
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i).map((pageNumber) => (
                    <Link
                      key={pageNumber}
                      className={
                        pageNumber === currentPage
                          ? "inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary px-2 text-xs text-primary-foreground"
                          : "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted"
                      }
                      href={withParams(baseParams, { page: String(pageNumber) })}
                    >
                      {pageNumber}
                    </Link>
                  ))}
                </div>
                {currentPage >= totalPages ? (
                  <span className="inline-flex h-8 items-center rounded-md border px-3 text-sm opacity-50">Next</span>
                ) : (
                  <Link
                    className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
                    href={withParams(baseParams, { page: String(Math.min(totalPages, currentPage + 1)) })}
                  >
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
      </div>
    </AppShell>
  );
}
