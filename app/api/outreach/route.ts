import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import { listOutreachRecords } from "@/lib/persistence/db";

export const runtime = "nodejs";

/**
 * GET /api/outreach
 * Returns all outreach records (admin only).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const records = await listOutreachRecords();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Outreach list failed" },
      { status: 503 },
    );
  }
}
