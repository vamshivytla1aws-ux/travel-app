import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { FinanceLoanForm } from "@/components/finance/finance-loan-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { normalizeFinanceStatus } from "@/lib/finance";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { safeDecodeURIComponent } from "@/lib/url";
import { FinanceLoansService } from "@/services/finance-loans.service";

const financeLoansService = new FinanceLoansService();

type Props = {
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    error?: string;
    q?: string;
    status?: string;
    create?: string;
    export?: string;
  }>;
};

function statusTone(status: string): "default" | "secondary" {
  if (status === "active") return "default";
  return "secondary";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

async function createLoan(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("finance");
  await ensureTransportEnhancements();

  const input = financeLoansService.parseWriteInput({
    registrationNo: formData.get("registrationNo"),
    vehicleTypeOrBusName: formData.get("vehicleTypeOrBusName"),
    purchaseDate: formData.get("purchaseDate"),
    vendorDealer: formData.get("vendorDealer"),
    financierBankName: formData.get("financierBankName"),
    loanAccountNumber: formData.get("loanAccountNumber"),
    loanType: formData.get("loanType"),
    interestRate: formData.get("interestRate"),
    totalBusCost: formData.get("totalBusCost"),
    downPayment: formData.get("downPayment"),
    loanAmountTaken: formData.get("loanAmountTaken"),
    processingFee: formData.get("processingFee"),
    insuranceAmountFinanced: formData.get("insuranceAmountFinanced"),
    emiAmount: formData.get("emiAmount"),
    loanStartDate: formData.get("loanStartDate"),
    loanEndDate: formData.get("loanEndDate"),
    status: normalizeFinanceStatus(String(formData.get("status") ?? "active")),
  });

  const result = await financeLoansService.createLoan(input, session.id);
  if ("error" in result) {
    redirect(`/finance?create=1&error=${encodeURIComponent(String(result.error))}`);
  }

  await logAuditEvent({
    session,
    action: "create",
    entityType: "finance_loan",
    entityId: result.id,
    details: { registrationNo: input.registrationNo, loanAccountNumber: input.loanAccountNumber },
  });
  revalidatePath("/finance");
  const createAnother = String(formData.get("createAnother") ?? "") === "1";
  redirect(createAnother ? `/finance?create=1&created=${Date.now()}` : `/finance?created=${Date.now()}`);
}

async function deleteLoan(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("finance");
  await ensureTransportEnhancements();

  const loanId = Number(formData.get("loanId"));
  if (!loanId) return;
  const result = await financeLoansService.deleteLoan(loanId);
  if ("error" in result) {
    redirect(`/finance?error=${encodeURIComponent(String(result.error))}`);
  }
  await logAuditEvent({
    session,
    action: "delete",
    entityType: "finance_loan",
    entityId: loanId,
  });
  revalidatePath("/finance");
  redirect(`/finance?deleted=${Date.now()}`);
}

export default async function FinancePage(props: Props) {
  await requireSession();
  await requireModuleAccess("finance");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;

  const q = String(searchParams.q ?? "").trim();
  const statusRaw = String(searchParams.status ?? "").trim().toLowerCase();
  const status =
    statusRaw === "active" || statusRaw === "closed" || statusRaw === "overdue" || statusRaw === "repossessed"
      ? normalizeFinanceStatus(statusRaw)
      : undefined;
  const loans = await financeLoansService.listLoans(q, status);
  const busOptionsResult = await query<{
    id: number;
    bus_number: string;
    registration_number: string;
    make: string;
    model: string;
  }>(
    `SELECT id, bus_number, registration_number, make, model
     FROM buses
     ORDER BY bus_number ASC`,
  );
  const showCreateModal = String(searchParams.create ?? "") === "1";
  const listBaseParams = new URLSearchParams();
  if (searchParams.q) listBaseParams.set("q", String(searchParams.q));
  if (searchParams.status) listBaseParams.set("status", String(searchParams.status));
  const listBaseHref = `/finance${listBaseParams.toString() ? `?${listBaseParams.toString()}` : ""}`;
  const createHrefParams = new URLSearchParams(listBaseParams);
  createHrefParams.set("create", "1");
  const createHref = `/finance?${createHrefParams.toString()}`;

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Finance"
        subtitle="Bus loan finance lifecycle, outstanding balances and EMI timeline"
        icon={Landmark}
        tag="Finance"
        actions={
          <ModuleExportLauncher
            moduleKey="finance"
            moduleLabel="Finance"
            basePath="/finance"
            searchParams={{
              q: searchParams.q,
              status: searchParams.status,
              export: searchParams.export,
              create: searchParams.create,
            }}
            defaultQuery={searchParams.q ?? ""}
            defaultStatus={searchParams.status ?? ""}
          />
        }
      />

      {searchParams.created ? <StatusAlert className="mb-4" tone="success" message="Loan record created successfully." /> : null}
      {searchParams.deleted ? <StatusAlert className="mb-4" tone="warning" message="Loan record deleted successfully." /> : null}
      {searchParams.error ? <StatusAlert className="mb-4" tone="error" message={safeDecodeURIComponent(searchParams.error)} /> : null}

      <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Bus Loan Records</CardTitle>
              <Link href={createHref} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                Create Finance
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-4">
              <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search registration / bus / bank / account" />
              <select name="status" defaultValue={searchParams.status ?? ""} className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm">
                <option value="">All status</option>
                <option value="active">active</option>
                <option value="closed">closed</option>
                <option value="overdue">overdue</option>
                <option value="repossessed">repossessed</option>
              </select>
              <button className="rounded-md border bg-primary px-3 py-2 text-sm text-primary-foreground">Apply</button>
              <Link href="/finance" className="inline-flex items-center rounded-md border px-3 py-2 text-sm">
                Clear
              </Link>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Financier</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>EMI</TableHead>
                  <TableHead>Months Paid</TableHead>
                  <TableHead>Months Left</TableHead>
                  <TableHead>Outstanding Principal</TableHead>
                  <TableHead>Outstanding Interest</TableHead>
                  <TableHead>Next EMI Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan, index) => (
                  <TableRow key={loan.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{loan.registrationNo}</TableCell>
                    <TableCell>{loan.vehicleTypeOrBusName}</TableCell>
                    <TableCell>{loan.financierBankName}</TableCell>
                    <TableCell>{formatCurrency(loan.loanAmountTaken)}</TableCell>
                    <TableCell>{formatCurrency(loan.emiAmount)}</TableCell>
                    <TableCell>{loan.monthsPaid}</TableCell>
                    <TableCell>{loan.monthsLeft}</TableCell>
                    <TableCell>{formatCurrency(loan.outstandingPrincipal)}</TableCell>
                    <TableCell>{formatCurrency(loan.outstandingInterest)}</TableCell>
                    <TableCell>{loan.nextEmiDate ? new Date(loan.nextEmiDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(loan.status)}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/finance/${loan.id}`} className="text-blue-600 hover:underline">
                          View
                        </Link>
                        <form action={deleteLoan}>
                          <input type="hidden" name="loanId" value={loan.id} />
                          <ConfirmSubmitButton
                            label="Delete"
                            message="Delete this finance loan record?"
                            className="text-red-600 hover:underline"
                          />
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {loans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground">
                      No finance loan records found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
      </Card>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
          <Card className="max-h-[85vh] w-full max-w-4xl overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Create Finance / Loan Record</CardTitle>
                <Link href={listBaseHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                  Close
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <FinanceLoanForm
                action={createLoan}
                submitLabel="Create Loan"
                showCreateAnother
                busOptions={busOptionsResult.rows.map((bus) => ({
                  id: bus.id,
                  busNumber: bus.bus_number,
                  registrationNumber: bus.registration_number,
                  vehicleLabel: `${bus.make} ${bus.model}`.trim(),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
