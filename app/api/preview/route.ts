import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import {
  findProductionLead,
  findPreviewByLeadId,
  upsertPreviewRecord,
  updatePreviewStatus,
  listAllPreviews,
} from "@/lib/persistence/db";
import { buildPreviewConfig } from "@/lib/preview/builder";
import { generateSlug } from "@/lib/preview/slug";
import type { PreviewStatus } from "@/types/preview";

export const runtime = "nodejs";

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
 * Actions:
 *   generate  – builds a PreviewConfig and saves as DRAFT
 *   status    – transitions status (DRAFT → READY, READY → ARCHIVED, etc.)
 *   regenerate – re-runs builder over existing record
 */
export async function POST(request: Request) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      action?: "generate" | "status" | "regenerate";
      leadId?: string;
      previewId?: string;
      status?: PreviewStatus;
      adminLogoUrl?: string | null;
      adminHeroImageUrlOverride?: string | null;
    };

    // ── generate ──────────────────────────────────────────────────────────
    if (body.action === "generate" || body.action === "regenerate") {
      if (!body.leadId)
        return NextResponse.json({ error: "leadId required" }, { status: 400 });

      const lead = await findProductionLead(body.leadId);
      if (!lead)
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });

      // Check eligibility: only QUALIFIED leads (or explicit manual override)
      const qual = lead.qualificationStatus;
      const manual = lead.manualDecision;
      const eligible =
        qual === "QUALIFIED" ||
        manual === "QUALIFY" ||
        // For regenerate, allow existing HOLD if admin explicitly requested
        (body.action === "regenerate" && (qual === "HOLD" || manual === "HOLD"));

      if (!eligible) {
        return NextResponse.json(
          { error: `Lead qualification (${qual}) does not permit preview generation` },
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

      // Use deterministic ID based on leadId for upsert
      const previewId = `preview_${body.leadId}`;

      // Check if existing record to preserve status unless regenerating
      const existing = await findPreviewByLeadId(body.leadId);
      const status: PreviewStatus =
        body.action === "regenerate" && existing ? existing.status : "DRAFT";

      const record = await upsertPreviewRecord({
        id: previewId,
        leadId: body.leadId,
        slug: config.slug,
        status,
        vertical: "DENTAL",
        archetype: config.archetype,
        archetypeConfidence: config.archetypeConfidence,
        previewDepth: config.previewDepth,
        configJson: config,
      });

      return NextResponse.json({ record });
    }

    // ── status ────────────────────────────────────────────────────────────
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
