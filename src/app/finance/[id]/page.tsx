import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { FinanceLoanForm } from "@/components/finance/finance-loan-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusAlert } from "@/components/ui/status-alert";
import { requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { normalizeFinanceStatus } from "@/lib/finance";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { safeDecodeURIComponent } from "@/lib/url";
import { FinanceLoansService } from "@/services/finance-loans.service";

const financeLoansService = new FinanceLoansService();

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

async function updateLoan(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher", "updater"]);
  await requireModuleAccess("finance");
  await ensureTransportEnhancements();
  const loanId = Number(formData.get("loanId"));
  if (!loanId) redirect("/finance?error=Invalid loan id");

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

  const result = await financeLoansService.updateLoan(loanId, input, session.id);
  if ("error" in result) {
    redirect(`/finance/${loanId}?error=${encodeURIComponent(String(result.error))}`);
  }
  await logAuditEvent({
    session,
    action: "update",
    entityType: "finance_loan",
    entityId: loanId,
    details: { registrationNo: input.registrationNo, loanAccountNumber: input.loanAccountNumber },
  });
  revalidatePath(`/finance/${loanId}`);
  revalidatePath("/finance");
  redirect(`/finance/${loanId}?updated=${Date.now()}`);
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
    redirect(`/finance/${loanId}?error=${encodeURIComponent(String(result.error))}`);
  }
  await logAuditEvent({
    session,
    action: "delete",
    entityType: "finance_loan",
    entityId: loanId,
  });
  revalidatePath("/finance");
  redirect("/finance?deleted=1");
}

export default async function FinanceLoanDetailPage(props: Props) {
  await requireSession();
  await requireModuleAccess("finance");
  await ensureTransportEnhancements();
  const params = await props.params;
  const searchParams = await props.searchParams;
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const loan = await financeLoansService.getLoan(id);
  if (!loan) notFound();
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

  return (
    <AppShell>
      <EnterprisePageHeader
        title={`Finance Loan #${loan.id}`}
        subtitle={`${loan.registrationNo} • ${loan.vehicleTypeOrBusName}`}
        icon={Landmark}
        tag="Finance"
      />
      {searchParams.updated ? <StatusAlert className="mb-4" tone="success" message="Loan record updated successfully." /> : null}
      {searchParams.error ? <StatusAlert className="mb-4" tone="error" message={safeDecodeURIComponent(searchParams.error)} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit Loan Record</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceLoanForm
              action={updateLoan}
              submitLabel="Update Loan"
              hiddenFields={{ loanId: loan.id }}
              values={{
                registrationNo: loan.registrationNo,
                vehicleTypeOrBusName: loan.vehicleTypeOrBusName,
                purchaseDate: loan.purchaseDate,
                vendorDealer: loan.vendorDealer ?? "",
                financierBankName: loan.financierBankName,
                loanAccountNumber: loan.loanAccountNumber,
                loanType: loan.loanType ?? "",
                interestRate: String(loan.interestRate),
                totalBusCost: String(loan.totalBusCost),
                downPayment: String(loan.downPayment),
                loanAmountTaken: String(loan.loanAmountTaken),
                processingFee: String(loan.processingFee),
                insuranceAmountFinanced: String(loan.insuranceAmountFinanced),
                emiAmount: String(loan.emiAmount),
                loanStartDate: loan.loanStartDate,
                loanEndDate: loan.loanEndDate,
                status: loan.status,
              }}
              busOptions={busOptionsResult.rows.map((bus) => ({
                id: bus.id,
                busNumber: bus.bus_number,
                registrationNumber: bus.registration_number,
                vehicleLabel: `${bus.make} ${bus.model}`.trim(),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Registration:</strong> {loan.registrationNo}</p>
            <p><strong>Bank:</strong> {loan.financierBankName}</p>
            <p><strong>Loan Account:</strong> {loan.loanAccountNumber}</p>
            <p><strong>Status:</strong> {loan.status}</p>
            <p><strong>Outstanding Principal:</strong> {formatCurrency(loan.outstandingPrincipal)}</p>
            <p><strong>Outstanding Interest:</strong> {formatCurrency(loan.outstandingInterest)}</p>
            <p><strong>Next EMI Date:</strong> {loan.nextEmiDate ? new Date(loan.nextEmiDate).toLocaleDateString() : "-"}</p>
            <div className="pt-3">
              <form action={deleteLoan}>
                <input type="hidden" name="loanId" value={loan.id} />
                <ConfirmSubmitButton
                  label="Delete Loan"
                  message="Delete this finance loan record?"
                  className={buttonVariants({ variant: "destructive" })}
                />
              </form>
            </div>
            <div className="pt-2">
              <Link href="/finance" className={buttonVariants({ variant: "outline" })}>
                Back to Finance
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
