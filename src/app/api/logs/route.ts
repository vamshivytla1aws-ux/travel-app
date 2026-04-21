import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("logs");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureTransportEnhancements();

  const entity = String(request.nextUrl.searchParams.get("entity") ?? "");
  const action = String(request.nextUrl.searchParams.get("action") ?? "");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const logs = await query<{
    id: number;
    user_email: string | null;
    action: string;
    entity_type: string;
    entity_id: number | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT id, user_email, action, entity_type, entity_id, details, created_at::text
     FROM audit_logs
     WHERE ($1 = '' OR entity_type = $1)
       AND ($2 = '' OR action = $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [entity, action, limit],
  );
  return NextResponse.json(logs.rows);
}

