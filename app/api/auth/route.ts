import { NextResponse } from "next/server";
import { isAuthorized, sessionCookie } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  const probe = new Request(request.url, { headers: { authorization: `Bearer ${token ?? ""}` } });
  if (!token || !isAuthorized(probe)) return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  response.headers.set("Set-Cookie", sessionCookie(token, new URL(request.url).protocol === "https:"));
  return response;
}

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isAuthorized(request) });
}
