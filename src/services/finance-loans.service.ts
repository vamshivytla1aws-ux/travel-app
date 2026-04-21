import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import {
  calculateFinanceDerivedFields,
  FINANCE_STATUSES,
  normalizeFinanceStatus,
  type FinanceStatus,
} from "@/lib/finance";
import { query } from "@/lib/db";
import { FinanceLoan } from "@/lib/types";
import {
  FinanceLoanCreateInput,
  FinanceLoansRepository,
  FinanceLoanRow,
  FinanceLoanUpdateInput,
} from "@/repositories/finance-loans.repository";

const financeLoansRepository = new FinanceLoansRepository();

export type FinanceLoanWriteInput = {
  registrationNo: string;
  vehicleTypeOrBusName: string;
  purchaseDate: string;
  vendorDealer: string;
  financierBankName: string;
  loanAccountNumber: string;
  loanType: string;
  interestRate: number;
  totalBusCost: number;
  downPayment: number;
  loanAmountTaken: number;
  processingFee: number;
  insuranceAmountFinanced: number;
  emiAmount: number;
  loanStartDate: string;
  loanEndDate: string;
  status: FinanceStatus;
};

function toMoney(value: number) {
  return Number(Math.max(value, 0).toFixed(2));
}

function mapLoan(row: FinanceLoanRow): FinanceLoan {
  return {
    id: row.id,
    registrationNo: row.registration_no,
    vehicleTypeOrBusName: row.vehicle_type_or_bus_name,
    purchaseDate: row.purchase_date,
    vendorDealer: row.vendor_dealer,
    financierBankName: row.financier_bank_name,
    loanAccountNumber: row.loan_account_number,
    loanType: row.loan_type,
    interestRate: Number(row.interest_rate),
    totalBusCost: Number(row.total_bus_cost),
    downPayment: Number(row.down_payment),
    loanAmountTaken: Number(row.loan_amount_taken),
    processingFee: Number(row.processing_fee),
    insuranceAmountFinanced: Number(row.insurance_amount_financed),
    emiAmount: Number(row.emi_amount),
    loanStartDate: row.loan_start_date,
    loanEndDate: row.loan_end_date,
    totalTenureMonths: row.total_tenure_months,
    monthsPaid: row.months_paid,
    monthsLeft: row.months_left,
    outstandingPrincipal: Number(row.outstanding_principal),
    outstandingInterest: Number(row.outstanding_interest),
    nextEmiDate: row.next_emi_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateInput(input: FinanceLoanWriteInput): string | null {
  if (!input.registrationNo.trim()) return "Registration No is required";
  if (!input.vehicleTypeOrBusName.trim()) return "Vehicle Type / Bus Name is required";
  if (!input.purchaseDate) return "Purchase Date is required";
  if (!parseDate(input.purchaseDate)) return "Purchase Date is invalid";
  if (!input.financierBankName.trim()) return "Financier / Bank Name is required";
  if (!input.loanAccountNumber.trim()) return "Loan Account Number is required";
  if (input.interestRate < 0 || !Number.isFinite(input.interestRate)) return "Interest Rate must be 0 or greater";
  if (input.totalBusCost < 0 || !Number.isFinite(input.totalBusCost)) return "Total Bus Cost must be 0 or greater";
  if (input.downPayment < 0 || !Number.isFinite(input.downPayment)) return "Down Payment must be 0 or greater";
  if (input.loanAmountTaken < 0 || !Number.isFinite(input.loanAmountTaken)) return "Loan Amount Taken must be 0 or greater";
  if (input.emiAmount < 0 || !Number.isFinite(input.emiAmount)) return "EMI Amount must be 0 or greater";
  if (!input.loanStartDate || !parseDate(input.loanStartDate)) return "Loan Start Date is required";
  if (!input.loanEndDate || !parseDate(input.loanEndDate)) return "Loan End Date is required";
  const start = parseDate(input.loanStartDate);
  const end = parseDate(input.loanEndDate);
  if (!start || !end || end <= start) return "Loan End Date must be after Loan Start Date";
  if (!FINANCE_STATUSES.includes(input.status)) return "Status is invalid";
  return null;
}

function buildCreatePayload(
  input: FinanceLoanWriteInput,
  userId: number | null,
): FinanceLoanCreateInput {
  const derived = calculateFinanceDerivedFields({
    loanAmountTaken: input.loanAmountTaken,
    interestRate: input.interestRate,
    loanStartDate: input.loanStartDate,
    loanEndDate: input.loanEndDate,
    status: input.status,
  });
  return {
    registrationNo: input.registrationNo.trim(),
    vehicleTypeOrBusName: input.vehicleTypeOrBusName.trim(),
    purchaseDate: input.purchaseDate,
    vendorDealer: input.vendorDealer.trim() || null,
    financierBankName: input.financierBankName.trim(),
    loanAccountNumber: input.loanAccountNumber.trim(),
    loanType: input.loanType.trim() || null,
    interestRate: toMoney(input.interestRate),
    totalBusCost: toMoney(input.totalBusCost),
    downPayment: toMoney(input.downPayment),
    loanAmountTaken: toMoney(input.loanAmountTaken),
    processingFee: toMoney(input.processingFee),
    insuranceAmountFinanced: toMoney(input.insuranceAmountFinanced),
    emiAmount: toMoney(input.emiAmount),
    loanStartDate: input.loanStartDate,
    loanEndDate: input.loanEndDate,
    totalTenureMonths: derived.totalTenureMonths,
    monthsPaid: derived.monthsPaid,
    monthsLeft: derived.monthsLeft,
    outstandingPrincipal: derived.outstandingPrincipal,
    outstandingInterest: derived.outstandingInterest,
    nextEmiDate: derived.nextEmiDate,
    status: input.status,
    createdBy: userId,
  };
}

function buildUpdatePayload(
  input: FinanceLoanWriteInput,
  userId: number | null,
): FinanceLoanUpdateInput {
  const base = buildCreatePayload(input, userId);
  return {
    ...base,
    updatedBy: userId,
  };
}

export class FinanceLoansService {
  async listLoans(search = "", status?: FinanceLoan["status"]) {
    await ensureTransportEnhancements();
    const rows = await financeLoansRepository.list(search, status);
    return rows.map(mapLoan);
  }

  async getLoan(id: number) {
    await ensureTransportEnhancements();
    const row = await financeLoansRepository.getById(id);
    return row ? mapLoan(row) : null;
  }

  async createLoan(input: FinanceLoanWriteInput, userId: number) {
    await ensureTransportEnhancements();
    const validationError = validateInput(input);
    if (validationError) return { error: validationError };

    const duplicate = await query<{ id: number }>(
      `SELECT id FROM finance_loans WHERE loan_account_number = $1 LIMIT 1`,
      [input.loanAccountNumber.trim()],
    );
    if ((duplicate.rowCount ?? 0) > 0) return { error: "Loan Account Number already exists" as const };

    const id = await financeLoansRepository.create(buildCreatePayload(input, userId));
    return { id };
  }

  async updateLoan(id: number, input: FinanceLoanWriteInput, userId: number) {
    await ensureTransportEnhancements();
    const validationError = validateInput(input);
    if (validationError) return { error: validationError };

    const duplicate = await query<{ id: number }>(
      `SELECT id FROM finance_loans WHERE loan_account_number = $1 AND id <> $2 LIMIT 1`,
      [input.loanAccountNumber.trim(), id],
    );
    if ((duplicate.rowCount ?? 0) > 0) return { error: "Loan Account Number already exists" as const };

    const ok = await financeLoansRepository.update(id, buildUpdatePayload(input, userId));
    if (!ok) return { error: "Loan record not found" as const };
    return { success: true as const };
  }

  async deleteLoan(id: number) {
    await ensureTransportEnhancements();
    const ok = await financeLoansRepository.delete(id);
    if (!ok) return { error: "Loan record not found" as const };
    return { success: true as const };
  }

  parseWriteInput(raw: Record<string, unknown>): FinanceLoanWriteInput {
    return {
      registrationNo: String(raw.registrationNo ?? "").trim(),
      vehicleTypeOrBusName: String(raw.vehicleTypeOrBusName ?? "").trim(),
      purchaseDate: String(raw.purchaseDate ?? "").trim(),
      vendorDealer: String(raw.vendorDealer ?? "").trim(),
      financierBankName: String(raw.financierBankName ?? "").trim(),
      loanAccountNumber: String(raw.loanAccountNumber ?? "").trim(),
      loanType: String(raw.loanType ?? "").trim(),
      interestRate: Number(raw.interestRate ?? 0),
      totalBusCost: Number(raw.totalBusCost ?? 0),
      downPayment: Number(raw.downPayment ?? 0),
      loanAmountTaken: Number(raw.loanAmountTaken ?? 0),
      processingFee: Number(raw.processingFee ?? 0),
      insuranceAmountFinanced: Number(raw.insuranceAmountFinanced ?? 0),
      emiAmount: Number(raw.emiAmount ?? 0),
      loanStartDate: String(raw.loanStartDate ?? "").trim(),
      loanEndDate: String(raw.loanEndDate ?? "").trim(),
      status: normalizeFinanceStatus(String(raw.status ?? "active")),
    };
  }
}
