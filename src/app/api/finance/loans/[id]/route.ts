import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { FinanceLoansService } from "@/services/finance-loans.service";

const financeLoansService = new FinanceLoansService();

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("finance");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const loan = await financeLoansService.getLoan(id);
  if (!loan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(loan);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("finance");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const input = financeLoansService.parseWriteInput(body as Record<string, unknown>);
  const result = await financeLoansService.updateLoan(id, input, session.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  await logAuditEvent({
    session,
    action: "update",
    entityType: "finance_loan",
    entityId: id,
    details: { registrationNo: input.registrationNo, loanAccountNumber: input.loanAccountNumber },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("finance");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const result = await financeLoansService.deleteLoan(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });

  await logAuditEvent({
    session,
    action: "delete",
    entityType: "finance_loan",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
