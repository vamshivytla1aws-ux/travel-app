import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getPublicRequestBase(request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return new URL(`${proto}://${host}`);
  return request.nextUrl;
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get("etms_session")?.value;
  const { pathname } = request.nextUrl;
  const isServerActionRequest =
    request.method === "POST" &&
    (request.headers.has("next-action") || request.headers.get("content-type")?.includes("multipart/form-data"));

  // Let Server Actions flow through untouched. Redirecting these requests in
  // middleware can strip action headers and trigger "Missing next-action header".
  if (isServerActionRequest) {
    return NextResponse.next();
  }

  const protectedPaths = [
    "/dashboard",
    "/buses",
    "/employees",
    "/drivers",
    "/routes",
    "/tracking",
    "/finance",
  ];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", getPublicRequestBase(request)));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
