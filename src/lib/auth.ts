import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "etms_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "replace-this-secret");

export const APP_MODULES = [
  "dashboard",
  "buses",
  "trips",
  "drivers",
  "employees",
  "routes",
  "tracking",
  "fuel-entry",
  "user-admin",
  "logs",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export type SessionUser = {
  id: number;
  email: string;
  role: "admin" | "dispatcher" | "fuel_manager" | "viewer";
  fullName: string;
  moduleAccess: AppModule[];
};

/**
 * `Secure` cookies are not sent on plain HTTP. Production builds (`next start`)
 * on localhost would otherwise never persist sessions. Real deployments use HTTPS.
 */
export function sessionCookieSecureForHost(hostHeader: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const host = hostHeader?.split(":")[0]?.toLowerCase();
  return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecureForHost(host),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const parsed = payload as unknown as Partial<SessionUser>;
    return {
      id: Number(parsed.id),
      email: String(parsed.email),
      role: (parsed.role ?? "viewer") as SessionUser["role"],
      fullName: String(parsed.fullName ?? "User"),
      moduleAccess: Array.isArray(parsed.moduleAccess) ? (parsed.moduleAccess as AppModule[]) : ["dashboard"],
    };
  } catch {
    return null;
  }
}

export async function requireSession(roles?: SessionUser["role"][]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.role)) redirect("/unauthorized");
  return session;
}

export function hasModuleAccess(session: SessionUser, module: AppModule): boolean {
  if (session.role === "admin") return true;
  return session.moduleAccess.includes(module);
}

export async function requireModuleAccess(module: AppModule) {
  const session = await requireSession();
  if (!hasModuleAccess(session, module)) redirect("/unauthorized");
  return session;
}
