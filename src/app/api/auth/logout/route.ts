import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

function resolveRedirectTarget(request: Request) {
  const url = new URL(request.url);
  return new URL("/login", `${url.protocol}//${url.host}`);
}

export async function GET(request: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(resolveRedirectTarget(request));
}

export async function POST(request: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(resolveRedirectTarget(request));
}

