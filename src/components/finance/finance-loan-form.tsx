"use client";

import { useMemo, useState } from "react";
import { calculateFinanceDerivedFields, FINANCE_STATUSES, normalizeFinanceStatus } from "@/lib/finance";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FormAction = string | ((formData: FormData) => void | Promise<void>);

type FinanceLoanFormValues = {
  registrationNo: string;
  vehicleTypeOrBusName: string;
  purchaseDate: string;
  vendorDealer: string;
  financierBankName: string;
  loanAccountNumber: string;
  loanType: string;
  interestRate: string;
  totalBusCost: string;
  downPayment: string;
  loanAmountTaken: string;
  processingFee: string;
  insuranceAmountFinanced: string;
  emiAmount: string;
  loanStartDate: string;
  loanEndDate: string;
  status: string;
};

type Props = {
  action: FormAction;
  submitLabel: string;
  values?: Partial<FinanceLoanFormValues>;
  hiddenFields?: Record<string, string | number>;
};

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function FinanceLoanForm({ action, submitLabel, values, hiddenFields }: Props) {
  const [formValues, setFormValues] = useState<FinanceLoanFormValues>({
    registrationNo: values?.registrationNo ?? "",
    vehicleTypeOrBusName: values?.vehicleTypeOrBusName ?? "",
    purchaseDate: values?.purchaseDate ?? "",
    vendorDealer: values?.vendorDealer ?? "",
    financierBankName: values?.financierBankName ?? "",
    loanAccountNumber: values?.loanAccountNumber ?? "",
    loanType: values?.loanType ?? "",
    interestRate: values?.interestRate ?? "",
    totalBusCost: values?.totalBusCost ?? "",
    downPayment: values?.downPayment ?? "",
    loanAmountTaken: values?.loanAmountTaken ?? "",
    processingFee: values?.processingFee ?? "",
    insuranceAmountFinanced: values?.insuranceAmountFinanced ?? "",
    emiAmount: values?.emiAmount ?? "",
    loanStartDate: values?.loanStartDate ?? "",
    loanEndDate: values?.loanEndDate ?? "",
    status: normalizeFinanceStatus(values?.status ?? "active"),
  });

  const derived = useMemo(
    () =>
      calculateFinanceDerivedFields({
        loanAmountTaken: asNumber(formValues.loanAmountTaken),
        interestRate: asNumber(formValues.interestRate),
        loanStartDate: formValues.loanStartDate,
        loanEndDate: formValues.loanEndDate,
        status: normalizeFinanceStatus(formValues.status),
      }),
    [
      formValues.interestRate,
      formValues.loanAmountTaken,
      formValues.loanStartDate,
      formValues.loanEndDate,
      formValues.status,
    ],
  );

  return (
    <form action={action} className="grid gap-4">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={String(value)} />
          ))
        : null}

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
        <p className="text-xs font-medium text-muted-foreground uppercase md:col-span-2">Vehicle / Purchase Details</p>
        <div className="grid gap-1">
          <Label htmlFor="registrationNo">Registration No</Label>
          <Input id="registrationNo" name="registrationNo" required value={formValues.registrationNo} onChange={(e) => setFormValues((v) => ({ ...v, registrationNo: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="vehicleTypeOrBusName">Vehicle Type / Bus Name</Label>
          <Input id="vehicleTypeOrBusName" name="vehicleTypeOrBusName" required value={formValues.vehicleTypeOrBusName} onChange={(e) => setFormValues((v) => ({ ...v, vehicleTypeOrBusName: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="purchaseDate">Purchase Date</Label>
          <Input id="purchaseDate" name="purchaseDate" type="date" required value={formValues.purchaseDate} onChange={(e) => setFormValues((v) => ({ ...v, purchaseDate: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="vendorDealer">Vendor / Dealer</Label>
          <Input id="vendorDealer" name="vendorDealer" value={formValues.vendorDealer} onChange={(e) => setFormValues((v) => ({ ...v, vendorDealer: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
        <p className="text-xs font-medium text-muted-foreground uppercase md:col-span-2">Loan Details</p>
        <div className="grid gap-1">
          <Label htmlFor="financierBankName">Financier / Bank Name</Label>
          <Input id="financierBankName" name="financierBankName" required value={formValues.financierBankName} onChange={(e) => setFormValues((v) => ({ ...v, financierBankName: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="loanAccountNumber">Loan Account Number</Label>
          <Input id="loanAccountNumber" name="loanAccountNumber" required value={formValues.loanAccountNumber} onChange={(e) => setFormValues((v) => ({ ...v, loanAccountNumber: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="loanType">Loan Type</Label>
          <Input id="loanType" name="loanType" value={formValues.loanType} onChange={(e) => setFormValues((v) => ({ ...v, loanType: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="interestRate">Interest Rate (%)</Label>
          <Input id="interestRate" name="interestRate" type="number" min={0} step="0.01" required value={formValues.interestRate} onChange={(e) => setFormValues((v) => ({ ...v, interestRate: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        <p className="text-xs font-medium text-muted-foreground uppercase md:col-span-3">Amount Details</p>
        <div className="grid gap-1">
          <Label htmlFor="totalBusCost">Total Bus Cost</Label>
          <Input id="totalBusCost" name="totalBusCost" type="number" min={0} step="0.01" required value={formValues.totalBusCost} onChange={(e) => setFormValues((v) => ({ ...v, totalBusCost: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="downPayment">Down Payment</Label>
          <Input id="downPayment" name="downPayment" type="number" min={0} step="0.01" required value={formValues.downPayment} onChange={(e) => setFormValues((v) => ({ ...v, downPayment: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="loanAmountTaken">Loan Amount Taken</Label>
          <Input id="loanAmountTaken" name="loanAmountTaken" type="number" min={0} step="0.01" required value={formValues.loanAmountTaken} onChange={(e) => setFormValues((v) => ({ ...v, loanAmountTaken: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="processingFee">Processing Fee</Label>
          <Input id="processingFee" name="processingFee" type="number" min={0} step="0.01" value={formValues.processingFee} onChange={(e) => setFormValues((v) => ({ ...v, processingFee: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="insuranceAmountFinanced">Insurance Amount Financed</Label>
          <Input id="insuranceAmountFinanced" name="insuranceAmountFinanced" type="number" min={0} step="0.01" value={formValues.insuranceAmountFinanced} onChange={(e) => setFormValues((v) => ({ ...v, insuranceAmountFinanced: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="emiAmount">EMI Amount</Label>
          <Input id="emiAmount" name="emiAmount" type="number" min={0} step="0.01" required value={formValues.emiAmount} onChange={(e) => setFormValues((v) => ({ ...v, emiAmount: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        <p className="text-xs font-medium text-muted-foreground uppercase md:col-span-3">Loan Timeline</p>
        <div className="grid gap-1">
          <Label htmlFor="loanStartDate">Loan Start Date</Label>
          <Input id="loanStartDate" name="loanStartDate" type="date" required value={formValues.loanStartDate} onChange={(e) => setFormValues((v) => ({ ...v, loanStartDate: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="loanEndDate">Loan End Date</Label>
          <Input id="loanEndDate" name="loanEndDate" type="date" required value={formValues.loanEndDate} onChange={(e) => setFormValues((v) => ({ ...v, loanEndDate: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
            value={formValues.status}
            onChange={(e) => setFormValues((v) => ({ ...v, status: normalizeFinanceStatus(e.target.value) }))}
          >
            {FINANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        <p className="text-xs font-medium text-muted-foreground uppercase md:col-span-3">Calculated (Read Only)</p>
        <div className="grid gap-1">
          <Label>Total Tenure (Months)</Label>
          <Input value={String(derived.totalTenureMonths)} readOnly />
        </div>
        <div className="grid gap-1">
          <Label>Months Paid</Label>
          <Input value={String(derived.monthsPaid)} readOnly />
        </div>
        <div className="grid gap-1">
          <Label>Months Left</Label>
          <Input value={String(derived.monthsLeft)} readOnly />
        </div>
        <div className="grid gap-1">
          <Label>Outstanding Principal</Label>
          <Input value={derived.outstandingPrincipal.toFixed(2)} readOnly />
        </div>
        <div className="grid gap-1">
          <Label>Outstanding Interest</Label>
          <Input value={derived.outstandingInterest.toFixed(2)} readOnly />
        </div>
        <div className="grid gap-1">
          <Label>Next EMI Date</Label>
          <Input value={derived.nextEmiDate ?? ""} readOnly />
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
