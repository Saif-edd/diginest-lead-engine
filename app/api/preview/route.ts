import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import {
  findProductionLead,
  findPreviewByLeadId,
  upsertPreviewRecord,
  updatePreviewStatus,
  updatePreviewWorkflowStatus,
  setPreviewBrief,
  setPreviewV0Pack,
  setFinalPreviewUrl,
  markReadyForOutreach,
  listAllPreviews,
  validatePreviewUrl,
} from "@/lib/persistence/db";
import { buildPreviewConfig } from "@/lib/preview/builder";
import { generateSlug } from "@/lib/preview/slug";
import { extractVerifiedFacts } from "@/lib/preview/facts";
import { resolvePreviewAssetPack } from "@/lib/preview/assets";
import { generateV0PromptPack } from "@/lib/preview/v0-prompt";
import type { PreviewStatus, V0WorkflowStatus } from "@/types/preview";

export const runtime = "nodejs";

// ---------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------

function isEligibleForPreview(
  qualificationStatus: string,
  manualDecision: string,
  allowHold = false,
): boolean {
  return (
    qualificationStatus === "QUALIFIED" ||
    manualDecision === "QUALIFY" ||
    (allowHold && (qualificationStatus === "HOLD" || manualDecision === "HOLD"))
  );
}

/**
 * GET /api/preview
 * Returns all preview records (admin only).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const records = await listAllPreviews();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview list failed" },
      { status: 503 },
    );
  }
}

/**
 * POST /api/preview
 *
 * Actions:
 *   generate        – builds legacy PreviewConfig and saves (backward compat)
 *   regenerate      – re-runs legacy builder
 *   status          – transitions legacy status
 *
 *   generate_brief  – extracts VerifiedFactsBlock + AssetPack → BRIEF_READY
 *   generate_prompt – builds V0PromptPack (requires brief) → PROMPT_READY
 *   mark_in_v0      – sets IN_V0
 *   add_preview_url – validates + stores final deployed URL → PREVIEW_LINK_ADDED
 *   mark_ready_for_outreach – explicit admin approval → READY_FOR_OUTREACH
 *   archive         – sets ARCHIVED
 */
export async function POST(request: Request) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      action?:
        | "generate"
        | "regenerate"
        | "status"
        | "generate_brief"
        | "generate_prompt"
        | "mark_in_v0"
        | "add_preview_url"
        | "mark_ready_for_outreach"
        | "archive";
      leadId?: string;
      previewId?: string;
      status?: PreviewStatus;
      workflowStatus?: V0WorkflowStatus;
      finalPreviewUrl?: string;
      adminLogoUrl?: string | null;
      adminHeroImageUrlOverride?: string | null;
    };

    // ── generate_brief ─────────────────────────────────────────────────────
    if (body.action === "generate_brief") {
      if (!body.leadId)
        return NextResponse.json({ error: "leadId required" }, { status: 400 });

      let lead = await findProductionLead(body.leadId);
      if (!lead)
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });

      // HEAL: If a manual review was performed but the lead object didn't store it 
      // (due to the bug in applyQualitativeResultToLead), patch it in memory.
      if (
        !lead.manualDecision &&
        lead.audit?.qualitativeResult?.qualificationDecisionSource === "MANUAL_REVIEW"
      ) {
        lead.manualDecision = lead.audit.qualitativeResult.qualificationDecision;
      }

      if (!isEligibleForPreview(lead.qualificationStatus, lead.manualDecision)) {
        return NextResponse.json(
          { error: `Lead qualification (${lead.qualificationStatus}) does not permit preview studio access` },
          { status: 422 },
        );
      }

      // Ensure a preview record exists
      const previewId = `preview_${body.leadId}`;
      let existing = await findPreviewByLeadId(body.leadId);

      if (!existing) {
        // Bootstrap a minimal record so we have an ID to work with
        const slug = generateSlug(lead.name, lead.address?.split(",")[0]?.trim() ?? "", "dentist");
        await upsertPreviewRecord({
          id: previewId,
          leadId: body.leadId,
          slug,
          status: "NOT_STARTED",
          workflowStatus: "NOT_STARTED",
          vertical: "DENTAL",
          archetype: "DENTAL_CORE",
          archetypeConfidence: "LOW",
          previewDepth: "LIGHT",
          configJson: {} as import("@/types/preview").PreviewConfig,
        });
        existing = await findPreviewByLeadId(body.leadId);
      }

      if (!existing)
        return NextResponse.json({ error: "Failed to create preview record" }, { status: 500 });

      // Extract facts and assets
      const verifiedFacts = extractVerifiedFacts(lead);
      const assetPack = await resolvePreviewAssetPack(lead, {
        logoUrl: body.adminLogoUrl,
        heroImageUrlOverride: body.adminHeroImageUrlOverride,
      });

      await setPreviewBrief(existing.id, verifiedFacts, assetPack);

      const updated = await findPreviewByLeadId(body.leadId);
      return NextResponse.json({ record: updated, verifiedFacts, assetPack });
    }

    // ── generate_prompt ────────────────────────────────────────────────────
    if (body.action === "generate_prompt") {
      if (!body.leadId)
        return NextResponse.json({ error: "leadId required" }, { status: 400 });

      let lead = await findProductionLead(body.leadId);
      if (!lead)
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });

      // HEAL
      if (
        !lead.manualDecision &&
        lead.audit?.qualitativeResult?.qualificationDecisionSource === "MANUAL_REVIEW"
      ) {
        lead.manualDecision = lead.audit.qualitativeResult.qualificationDecision;
      }

      if (!isEligibleForPreview(lead.qualificationStatus, lead.manualDecision)) {
        return NextResponse.json(
          { error: `Lead not eligible for preview studio` },
          { status: 422 },
        );
      }

      const existing = await findPreviewByLeadId(body.leadId);
      if (!existing)
        return NextResponse.json(
          { error: "No preview record found. Run generate_brief first." },
          { status: 422 },
        );

      // Use stored facts/assets or regenerate if not present
      const verifiedFacts =
        existing.verifiedFacts ?? extractVerifiedFacts(lead);
      const assetPack =
        existing.assetPack ??
        (await resolvePreviewAssetPack(lead, {
          logoUrl: body.adminLogoUrl,
          heroImageUrlOverride: body.adminHeroImageUrlOverride,
        }));

      const v0PromptPack = generateV0PromptPack(lead, verifiedFacts, assetPack);
      await setPreviewV0Pack(existing.id, v0PromptPack);

      const updated = await findPreviewByLeadId(body.leadId);
      return NextResponse.json({ record: updated, v0PromptPack });
    }

    // ── mark_in_v0 ─────────────────────────────────────────────────────────
    if (body.action === "mark_in_v0") {
      if (!body.previewId)
        return NextResponse.json({ error: "previewId required" }, { status: 400 });
      await updatePreviewWorkflowStatus(body.previewId, "IN_V0");
      return NextResponse.json({ updated: true });
    }

    // ── add_preview_url ────────────────────────────────────────────────────
    if (body.action === "add_preview_url") {
      if (!body.previewId || !body.finalPreviewUrl)
        return NextResponse.json(
          { error: "previewId and finalPreviewUrl required" },
          { status: 400 },
        );
      if (!validatePreviewUrl(body.finalPreviewUrl)) {
        return NextResponse.json(
          { error: "Invalid preview URL: must be http(s) and under 500 characters" },
          { status: 400 },
        );
      }
      const result = await setFinalPreviewUrl(body.previewId, body.finalPreviewUrl, "V0");
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ updated: true });
    }

    // ── mark_ready_for_outreach ────────────────────────────────────────────
    if (body.action === "mark_ready_for_outreach") {
      if (!body.previewId)
        return NextResponse.json({ error: "previewId required" }, { status: 400 });
      await markReadyForOutreach(body.previewId);
      return NextResponse.json({ updated: true });
    }

    // ── archive ────────────────────────────────────────────────────────────
    if (body.action === "archive") {
      if (!body.previewId)
        return NextResponse.json({ error: "previewId required" }, { status: 400 });
      await updatePreviewWorkflowStatus(body.previewId, "ARCHIVED");
      return NextResponse.json({ updated: true });
    }

    // ── generate (legacy) ──────────────────────────────────────────────────
    if (body.action === "generate" || body.action === "regenerate") {
      if (!body.leadId)
        return NextResponse.json({ error: "leadId required" }, { status: 400 });

      let lead = await findProductionLead(body.leadId);
      if (!lead)
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });

      // HEAL
      if (
        !lead.manualDecision &&
        lead.audit?.qualitativeResult?.qualificationDecisionSource === "MANUAL_REVIEW"
      ) {
        lead.manualDecision = lead.audit.qualitativeResult.qualificationDecision;
      }

      const eligible = isEligibleForPreview(
        lead.qualificationStatus,
        lead.manualDecision,
        body.action === "regenerate",
      );

      if (!eligible) {
        return NextResponse.json(
          { error: `Lead qualification (${lead.qualificationStatus}) does not permit preview generation` },
          { status: 422 },
        );
      }

      const config = await buildPreviewConfig(lead, {
        adminLogoUrl: body.adminLogoUrl,
        adminHeroImageUrlOverride: body.adminHeroImageUrlOverride,
      });

      if (!config) {
        return NextResponse.json(
          { error: "Cannot build preview: lead lacks qualitative analysis or depth is NONE" },
          { status: 422 },
        );
      }

      const previewId = `preview_${body.leadId}`;
      const existing = await findPreviewByLeadId(body.leadId);
      const status: PreviewStatus =
        body.action === "regenerate" && existing ? existing.status : "DRAFT";

      const record = await upsertPreviewRecord({
        id: previewId,
        leadId: body.leadId,
        slug: config.slug,
        status,
        workflowStatus: existing?.workflowStatus ?? "NOT_STARTED",
        vertical: "DENTAL",
        archetype: config.archetype,
        archetypeConfidence: config.archetypeConfidence,
        previewDepth: config.previewDepth,
        configJson: config,
      });

      return NextResponse.json({ record });
    }

    // ── status (legacy) ────────────────────────────────────────────────────
    if (body.action === "status") {
      if (!body.previewId || !body.status)
        return NextResponse.json({ error: "previewId and status required" }, { status: 400 });

      await updatePreviewStatus(body.previewId, body.status);
      return NextResponse.json({ updated: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview operation failed" },
      { status: 503 },
    );
  }
}
