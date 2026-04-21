import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { APP_MODULES } from "@/lib/auth";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("user-admin");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const result = await query<{
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
  }>(
    `SELECT id, full_name, email, role::text, is_active
     FROM users
     ORDER BY id DESC`,
  );

  const filtered = result.rows.filter((user) => {
    if (!q) return true;
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    );
  });

  return NextResponse.json(
    filtered.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
    })),
  );
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("user-admin");
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "viewer");
  const allowedRoles = ["admin", "dispatcher", "fuel_manager", "viewer", "updater"];
  const safeRole = allowedRoles.includes(role) ? role : "viewer";
  if (!fullName || !email || !password) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  const existing = await query<{ id: number }>(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  if ((existing.rowCount ?? 0) > 0) return NextResponse.json({ error: "Duplicate user" }, { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query<{ id: number }>(
    `INSERT INTO users(full_name, email, password_hash, role, module_access)
     VALUES($1,$2,$3,$4,$5)
     RETURNING id`,
    [fullName, email, passwordHash, safeRole, safeRole === "admin" ? [...APP_MODULES] : ["dashboard"]],
  );
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await requireApiModuleAccess("user-admin");
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const role = String(body?.role ?? "viewer");
  const allowedRoles = ["admin", "dispatcher", "fuel_manager", "viewer", "updater"];
  const safeRole = allowedRoles.includes(role) ? role : "viewer";
  const fullName = String(body?.fullName ?? "").trim();
  const isActive = body?.isActive;
  const access = Array.isArray(body?.moduleAccess)
    ? body.moduleAccess.filter((m: string) => APP_MODULES.includes(m as (typeof APP_MODULES)[number]))
    : undefined;

  await query(
    `UPDATE users
     SET full_name = COALESCE(NULLIF($1, ''), full_name),
         role = $2,
         module_access = COALESCE($3, module_access),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $5`,
    [fullName, safeRole, safeRole === "admin" ? [...APP_MODULES] : access, typeof isActive === "boolean" ? isActive : null, id],
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiModuleAccess("user-admin");
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
