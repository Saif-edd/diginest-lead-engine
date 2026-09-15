import { NextResponse } from "next/server";
import { appendProductionWorkspace, clearProductionWorkspace, loadProductionWorkspace, replaceProductionWorkspace, saveLead } from "@/lib/persistence/db";
import { isAuthorized } from "@/lib/security/auth";
import type { ImportMode, ImportReport } from "@/types/import";
import type { Lead } from "@/types/lead";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(await loadProductionWorkspace()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = (await request.json()) as { action?: "replace" | "append" | "clear" | "update"; leads?: Lead[]; report?: ImportReport; mode?: ImportMode; lead?: Lead };
    if (body.action === "clear") return NextResponse.json(await clearProductionWorkspace());
    if (body.action === "update" && body.lead) { await saveLead(body.lead); return NextResponse.json({ saved: true }); }
    if (!body.leads || !body.report || !body.mode) return NextResponse.json({ error: "action, leads, report and mode are required" }, { status: 400 });
    const workspace = body.mode === "REPLACE" ? await replaceProductionWorkspace(body.leads, body.report) : await appendProductionWorkspace(body.leads, body.report);
    return NextResponse.json(workspace);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace write failed" }, { status: 503 }); }
}
