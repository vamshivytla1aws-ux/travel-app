import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { FinanceLoansService } from "@/services/finance-loans.service";
import { normalizeFinanceStatus } from "@/lib/finance";

const financeLoansService = new FinanceLoansService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("finance");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const search = String(request.nextUrl.searchParams.get("search") ?? "");
  const statusRaw = String(request.nextUrl.searchParams.get("status") ?? "").trim().toLowerCase();
  const status =
    statusRaw === "active" || statusRaw === "closed" || statusRaw === "overdue" || statusRaw === "repossessed"
      ? normalizeFinanceStatus(statusRaw)
      : undefined;
  const loans = await financeLoansService.listLoans(search, status);
  return NextResponse.json(loans);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("finance");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const input = financeLoansService.parseWriteInput(body as Record<string, unknown>);
  const result = await financeLoansService.createLoan(input, session.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logAuditEvent({
    session,
    action: "create",
    entityType: "finance_loan",
    entityId: result.id,
    details: { registrationNo: input.registrationNo, loanAccountNumber: input.loanAccountNumber },
  });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
