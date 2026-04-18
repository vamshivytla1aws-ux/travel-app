import { query } from "@/lib/db";
import { SessionUser } from "@/lib/auth";

export async function logAuditEvent(input: {
  session: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO audit_logs(user_id, user_email, action, entity_type, entity_id, details)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      input.session?.id ?? null,
      input.session?.email ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.details ?? {}),
    ],
  );
}
