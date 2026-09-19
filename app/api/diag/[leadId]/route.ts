import { NextResponse } from "next/server";
import { findProductionLead } from "@/lib/persistence/db";
import { isAuthorized } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { leadId } = await context.params;
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
    const lead = await findProductionLead(leadId);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnostic lookup failed" },
      { status: 503 },
    );
  }
}
