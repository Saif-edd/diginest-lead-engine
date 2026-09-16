import { NextResponse } from "next/server";
import { applyQualitativeResultToLead } from "@/lib/qualitative/apply";
import { findProductionLead, saveLead } from "@/lib/persistence/db";
import { isAuthorized } from "@/lib/security/auth";
import type { QualitativeResult } from "@/types/qualitative";

export const runtime = "nodejs";

/**
 * POST /api/qualitative/manual
 *
 * Applies a pre-built, human-reviewed QualitativeResult to a lead.
 * Used exclusively for Sprint 2B manual calibration decisions where
 * the lead has a COMPLETE objective audit but the qualitative AI
 * has not yet run (or is being overridden with a human-reviewed decision).
 *
 * Security:
 * - Auth-gated (admin token required)
 * - The result must include qualificationDecisionSource: "MANUAL_REVIEW"
 * - Does NOT rerun the AI or call any external service
 *
 * Body: { leadId: string; result: QualitativeResult }
 */
export async function POST(request: Request) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      leadId?: string;
      result?: QualitativeResult;
    };

    if (!body.leadId || !body.result)
      return NextResponse.json({ error: "leadId and result are required" }, { status: 400 });

    if (body.result.qualificationDecisionSource !== "MANUAL_REVIEW")
      return NextResponse.json(
        { error: "result.qualificationDecisionSource must be 'MANUAL_REVIEW'" },
        { status: 422 },
      );

    const lead = await findProductionLead(body.leadId);
    if (!lead)
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    if (!lead.hasWebsite)
      return NextResponse.json(
        { error: "Lead must have a website for qualitative analysis" },
        { status: 409 },
      );

    if (lead.audit.objectiveAuditStatus !== "COMPLETE")
      return NextResponse.json(
        { error: "Objective audit must be COMPLETE before applying manual qualitative review" },
        { status: 409 },
      );

    const updatedLead = applyQualitativeResultToLead(lead, body.result, 0);
    await saveLead(updatedLead);

    return NextResponse.json({
      leadId: updatedLead.leadId,
      qualificationStatus: updatedLead.qualificationStatus,
      automaticQualification: updatedLead.automaticQualification,
      previewDepth: body.result.recommendedPreviewDepth,
      qualificationDecisionSource: body.result.qualificationDecisionSource,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual review application failed" },
      { status: 500 },
    );
  }
}
