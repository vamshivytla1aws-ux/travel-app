export const FINANCE_STATUSES = [
  "active",
  "closed",
  "overdue",
  "repossessed",
] as const;

export type FinanceStatus = (typeof FINANCE_STATUSES)[number];

export type FinanceLoanInput = {
  loanAmountTaken: number;
  interestRate: number;
  loanStartDate: string;
  loanEndDate: string;
  status: FinanceStatus;
};

export type FinanceDerivedFields = {
  totalTenureMonths: number;
  monthsPaid: number;
  monthsLeft: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  nextEmiDate: string | null;
};

function clamp(value: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  return Math.min(Math.max(value, min), max);
}

function parseDateAtUtcMidnight(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthsBetweenByCalendar(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() >= start.getUTCDate()) {
    months += 1;
  }
  return months;
}

function addMonthsUtc(base: Date, monthsToAdd: number): Date {
  const result = new Date(base.getTime());
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  return result;
}

function normalizeMoney(value: number): number {
  return Number(clamp(value).toFixed(2));
}

export function calculateFinanceDerivedFields(input: FinanceLoanInput): FinanceDerivedFields {
  const start = parseDateAtUtcMidnight(input.loanStartDate);
  const end = parseDateAtUtcMidnight(input.loanEndDate);
  const today = parseDateAtUtcMidnight(new Date().toISOString().slice(0, 10));

  if (!start || !end || !today || end <= start) {
    return {
      totalTenureMonths: 0,
      monthsPaid: 0,
      monthsLeft: 0,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      nextEmiDate: null,
    };
  }

  const totalTenureMonths = clamp(monthsBetweenByCalendar(start, end), 0, 1200);

  let monthsPaid = 0;
  if (today >= start) {
    monthsPaid =
      (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (today.getUTCMonth() - start.getUTCMonth());
    if (today.getUTCDate() < start.getUTCDate()) {
      monthsPaid -= 1;
    }
  }
  monthsPaid = clamp(monthsPaid, 0, totalTenureMonths);

  if (input.status === "closed") {
    monthsPaid = totalTenureMonths;
  }

  const monthsLeft = clamp(totalTenureMonths - monthsPaid, 0, totalTenureMonths);
  const safeLoanAmount = clamp(input.loanAmountTaken, 0);
  const safeRate = clamp(input.interestRate, 0);

  const principalPaidPerMonth =
    totalTenureMonths > 0 ? safeLoanAmount / totalTenureMonths : 0;
  let outstandingPrincipal = safeLoanAmount - principalPaidPerMonth * monthsPaid;
  outstandingPrincipal = clamp(outstandingPrincipal, 0, safeLoanAmount);

  if (input.status === "closed") {
    outstandingPrincipal = 0;
  }

  const monthlyInterestRate = safeRate / 12 / 100;
  let outstandingInterest = outstandingPrincipal * monthlyInterestRate * monthsLeft;
  outstandingInterest = clamp(outstandingInterest, 0);
  if (input.status === "closed") {
    outstandingInterest = 0;
  }

  let nextEmiDate: string | null = null;
  if (input.status !== "closed" && totalTenureMonths > 0 && monthsPaid < totalTenureMonths) {
    let nextDate = addMonthsUtc(start, monthsPaid);
    while (nextDate < today) {
      nextDate = addMonthsUtc(nextDate, 1);
    }
    nextEmiDate = formatUtcDate(nextDate);
  }

  return {
    totalTenureMonths,
    monthsPaid,
    monthsLeft,
    outstandingPrincipal: normalizeMoney(outstandingPrincipal),
    outstandingInterest: normalizeMoney(outstandingInterest),
    nextEmiDate,
  };
}

export function normalizeFinanceStatus(value: string): FinanceStatus {
  const normalized = value.trim().toLowerCase() as FinanceStatus;
  return FINANCE_STATUSES.includes(normalized) ? normalized : "active";
}
