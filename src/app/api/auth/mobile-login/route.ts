import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, normalizeModuleAccess, sessionCookieSecureForHost } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = String(payload?.email ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const userResult = await query<{
    id: number;
    full_name: string;
    email: string;
    password_hash: string;
    role: "admin" | "dispatcher" | "fuel_manager" | "viewer" | "updater";
    module_access: string[] | null;
  }>(
    `SELECT id, full_name, email, password_hash, role::text, module_access
     FROM users
     WHERE lower(email) = lower($1) AND is_active = true`,
    [email],
  );
  const user = userResult.rows[0];
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const resolvedModuleAccess = normalizeModuleAccess(user.module_access, user.role);

  const token = await createSession({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    moduleAccess: resolvedModuleAccess,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      moduleAccess: resolvedModuleAccess,
    },
  });
  response.cookies.set("etms_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecureForHost(request.headers.get("host")),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
