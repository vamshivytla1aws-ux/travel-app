import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
    "/fuel-entry",
    "/employees",
    "/drivers",
    "/routes",
    "/tracking",
  ];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
