import { query } from "@/lib/db";
import { FinanceLoan } from "@/lib/types";

export type FinanceLoanRow = {
  id: number;
  registration_no: string;
  vehicle_type_or_bus_name: string;
  purchase_date: string;
  vendor_dealer: string | null;
  financier_bank_name: string;
  loan_account_number: string;
  loan_type: string | null;
  interest_rate: string;
  total_bus_cost: string;
  down_payment: string;
  loan_amount_taken: string;
  processing_fee: string;
  insurance_amount_financed: string;
  emi_amount: string;
  loan_start_date: string;
  loan_end_date: string;
  total_tenure_months: number;
  months_paid: number;
  months_left: number;
  outstanding_principal: string;
  outstanding_interest: string;
  next_emi_date: string | null;
  status: FinanceLoan["status"];
  created_at: string;
  updated_at: string;
};

export type FinanceLoanCreateInput = Omit<FinanceLoan, "id" | "createdAt" | "updatedAt"> & {
  createdBy: number | null;
};

export type FinanceLoanUpdateInput = Omit<
  FinanceLoan,
  "id" | "createdAt" | "updatedAt"
> & {
  updatedBy: number | null;
};

export class FinanceLoansRepository {
  async list(search = "", status?: FinanceLoan["status"]) {
    const params: unknown[] = [];
    const where: string[] = [];
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(
        `(registration_no ILIKE $${params.length}
          OR vehicle_type_or_bus_name ILIKE $${params.length}
          OR financier_bank_name ILIKE $${params.length}
          OR loan_account_number ILIKE $${params.length})`,
      );
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query<FinanceLoanRow>(
      `SELECT
         id,
         registration_no,
         vehicle_type_or_bus_name,
         purchase_date::text,
         vendor_dealer,
         financier_bank_name,
         loan_account_number,
         loan_type,
         interest_rate::text,
         total_bus_cost::text,
         down_payment::text,
         loan_amount_taken::text,
         processing_fee::text,
         insurance_amount_financed::text,
         emi_amount::text,
         loan_start_date::text,
         loan_end_date::text,
         total_tenure_months,
         months_paid,
         months_left,
         outstanding_principal::text,
         outstanding_interest::text,
         next_emi_date::text,
         status,
         created_at::text,
         updated_at::text
       FROM finance_loans
       ${whereSql}
       ORDER BY id DESC`,
      params,
    );
    return result.rows;
  }

  async getById(id: number) {
    const result = await query<FinanceLoanRow>(
      `SELECT
         id,
         registration_no,
         vehicle_type_or_bus_name,
         purchase_date::text,
         vendor_dealer,
         financier_bank_name,
         loan_account_number,
         loan_type,
         interest_rate::text,
         total_bus_cost::text,
         down_payment::text,
         loan_amount_taken::text,
         processing_fee::text,
         insurance_amount_financed::text,
         emi_amount::text,
         loan_start_date::text,
         loan_end_date::text,
         total_tenure_months,
         months_paid,
         months_left,
         outstanding_principal::text,
         outstanding_interest::text,
         next_emi_date::text,
         status,
         created_at::text,
         updated_at::text
       FROM finance_loans
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(input: FinanceLoanCreateInput) {
    const result = await query<{ id: number }>(
      `INSERT INTO finance_loans(
        registration_no,
        vehicle_type_or_bus_name,
        purchase_date,
        vendor_dealer,
        financier_bank_name,
        loan_account_number,
        loan_type,
        interest_rate,
        total_bus_cost,
        down_payment,
        loan_amount_taken,
        processing_fee,
        insurance_amount_financed,
        emi_amount,
        loan_start_date,
        loan_end_date,
        total_tenure_months,
        months_paid,
        months_left,
        outstanding_principal,
        outstanding_interest,
        next_emi_date,
        status,
        created_by,
        updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$24
      )
      RETURNING id`,
      [
        input.registrationNo,
        input.vehicleTypeOrBusName,
        input.purchaseDate,
        input.vendorDealer,
        input.financierBankName,
        input.loanAccountNumber,
        input.loanType,
        input.interestRate,
        input.totalBusCost,
        input.downPayment,
        input.loanAmountTaken,
        input.processingFee,
        input.insuranceAmountFinanced,
        input.emiAmount,
        input.loanStartDate,
        input.loanEndDate,
        input.totalTenureMonths,
        input.monthsPaid,
        input.monthsLeft,
        input.outstandingPrincipal,
        input.outstandingInterest,
        input.nextEmiDate,
        input.status,
        input.createdBy,
      ],
    );
    return result.rows[0].id;
  }

  async update(id: number, input: FinanceLoanUpdateInput) {
    const result = await query<{ id: number }>(
      `UPDATE finance_loans
       SET registration_no = $1,
           vehicle_type_or_bus_name = $2,
           purchase_date = $3,
           vendor_dealer = $4,
           financier_bank_name = $5,
           loan_account_number = $6,
           loan_type = $7,
           interest_rate = $8,
           total_bus_cost = $9,
           down_payment = $10,
           loan_amount_taken = $11,
           processing_fee = $12,
           insurance_amount_financed = $13,
           emi_amount = $14,
           loan_start_date = $15,
           loan_end_date = $16,
           total_tenure_months = $17,
           months_paid = $18,
           months_left = $19,
           outstanding_principal = $20,
           outstanding_interest = $21,
           next_emi_date = $22,
           status = $23,
           updated_by = $24,
           updated_at = NOW()
       WHERE id = $25
       RETURNING id`,
      [
        input.registrationNo,
        input.vehicleTypeOrBusName,
        input.purchaseDate,
        input.vendorDealer,
        input.financierBankName,
        input.loanAccountNumber,
        input.loanType,
        input.interestRate,
        input.totalBusCost,
        input.downPayment,
        input.loanAmountTaken,
        input.processingFee,
        input.insuranceAmountFinanced,
        input.emiAmount,
        input.loanStartDate,
        input.loanEndDate,
        input.totalTenureMonths,
        input.monthsPaid,
        input.monthsLeft,
        input.outstandingPrincipal,
        input.outstandingInterest,
        input.nextEmiDate,
        input.status,
        input.updatedBy,
        id,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: number) {
    const result = await query(`DELETE FROM finance_loans WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
