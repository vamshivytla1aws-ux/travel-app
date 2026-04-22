import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { APP_MODULES, createSession, normalizeModuleAccess, sessionCookieSecureForHost } from "@/lib/auth";
import { query } from "@/lib/db";

function getPublicRequestBase(request: Request): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return new URL(`${proto}://${host}`);
  return new URL(request.url);
}

export async function POST(request: Request) {
  const publicBase = getPublicRequestBase(request);
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

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

  const fallbackAllowed =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_FALLBACK_LOGIN === "true" &&
    email === "admin@transport.local" &&
    password === "Admin@123";

  if (!user && !fallbackAllowed) {
    return NextResponse.redirect(new URL("/login?error=invalid", publicBase));
  }

  if (user) {
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.redirect(new URL("/login?error=invalid", publicBase));
    }
  }

  const finalToken = user
    ? await createSession({
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        moduleAccess: normalizeModuleAccess(user.module_access, user.role),
      })
    : await createSession(
        {
          id: 0,
          email,
          role: "admin",
          fullName: "Local Admin",
          moduleAccess: [...APP_MODULES],
        },
      );

  const response = NextResponse.redirect(new URL("/dashboard", publicBase));
  response.cookies.set("etms_session", finalToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecureForHost(request.headers.get("host")),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
