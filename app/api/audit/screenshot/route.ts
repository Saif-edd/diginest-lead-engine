import { NextResponse } from "next/server";
import { readAuditScreenshot } from "@/lib/storage/screenshots";
import { isAuthorized } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !url.startsWith("https://")) return NextResponse.json({ error: "Invalid screenshot URL" }, { status: 400 });
  const screenshotUrl = new URL(url);
  if (!screenshotUrl.hostname.endsWith(".blob.vercel-storage.com")) return NextResponse.json({ error: "Unsupported screenshot storage host" }, { status: 400 });
  try {
    const result = await readAuditScreenshot(url);
    if (!result) return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    const headers = new Headers(result.headers as unknown as Record<string, string>);
    headers.set("Cache-Control", "private, max-age=300");
    return new Response(result.stream, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Screenshot unavailable" }, { status: 404 });
  }
}
