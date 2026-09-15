import { NextResponse } from "next/server";
import { objectiveStatusFor } from "@/lib/audit/state";
import { applyQualitativeResultToLead } from "@/lib/qualitative/apply";
import { analyzeQualitative, buildQualitativeAnalysisInput } from "@/lib/qualitative/analyzer";
import { qualitativeStatusFor, transitionQualitativeStatus } from "@/lib/qualitative/state";
import { QualitativeValidationError } from "@/lib/qualitative/schema";
import { QualitativeProviderError } from "@/lib/qualitative/provider";
import { qualitativeIdempotencyKey } from "@/lib/qualitative/idempotency";
import { findProductionLead, getQualitativeResult, persistQualitativeResult, saveLead } from "@/lib/persistence/db";
import { checkRateLimit, isAuthorized } from "@/lib/security/auth";
import type { QualitativeFailureReason, WebsiteAudit } from "@/types/audit";

export const runtime = "nodejs";

function failureReason(error: unknown): QualitativeFailureReason {
  if (error instanceof QualitativeValidationError) return "INVALID_AI_OUTPUT";
  if (error instanceof QualitativeProviderError) {
    if (error.code === "NOT_CONFIGURED") return "NOT_CONFIGURED";
    if (error.code === "TIMEOUT") return "TIMEOUT";
  }
  return "PROVIDER_ERROR";
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Qualitative analysis failed";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!checkRateLimit(request, 6)) return NextResponse.json({ error: "Qualitative analysis rate limit exceeded" }, { status: 429 });
  try {
    const body = await request.json() as { leadId?: string; retryCount?: number; idempotencyKey?: string };
    if (!body.leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    const lead = await findProductionLead(body.leadId);
    if (!lead || !lead.hasWebsite) return NextResponse.json({ error: "Production website lead not found" }, { status: 404 });
    if (objectiveStatusFor(lead.audit) !== "COMPLETE") return NextResponse.json({ error: "Objective audit must be COMPLETE before qualitative analysis" }, { status: 409 });
    const retryCount = Number.isInteger(body.retryCount) && (body.retryCount ?? 0) > 0
      ? body.retryCount!
      : (lead.audit.qualitativeRetryCount ?? 0) + 1;
    const key = body.idempotencyKey ?? qualitativeIdempotencyKey(lead, retryCount);
    const existing = await getQualitativeResult(key);
    if (existing) {
      const restored = applyQualitativeResultToLead(lead, existing, retryCount);
      return NextResponse.json({ audit: restored.audit, result: existing, idempotent: true });
    }

    const currentStatus = qualitativeStatusFor(lead.audit);
    const pending = currentStatus === "COMPLETE"
      ? transitionQualitativeStatus(lead.audit, "PENDING")
      : lead.audit;
    const startedAt = new Date().toISOString();
    const analyzing = transitionQualitativeStatus({
      ...pending,
      qualitativeRetryCount: retryCount,
      qualitativeStartedAt: startedAt,
      qualitativeHeartbeatAt: startedAt,
      qualitativeFailureReason: undefined,
      qualitativeFailureMessage: undefined,
      qualitativeCompletedAt: undefined,
    }, "ANALYZING");
    await saveLead({ ...lead, audit: analyzing });

    try {
      const input = await buildQualitativeAnalysisInput({ ...lead, audit: analyzing });
      const result = await analyzeQualitative(input);
      const analyzedLead = applyQualitativeResultToLead({ ...lead, audit: analyzing }, result, retryCount);
      const storedResult = await persistQualitativeResult(analyzedLead, analyzedLead.audit, result, key);
      const finalLead = storedResult === result
        ? analyzedLead
        : applyQualitativeResultToLead({ ...lead, audit: analyzing }, storedResult, retryCount);
      return NextResponse.json({ audit: finalLead.audit, result: storedResult });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const failedAudit: WebsiteAudit = {
        ...analyzing,
        qualitativeAuditStatus: "FAILED",
        qualitativeCompletedAt: timestamp,
        qualitativeHeartbeatAt: timestamp,
        qualitativeFailureReason: failureReason(error),
        qualitativeFailureMessage: failureMessage(error),
      };
      await saveLead({ ...lead, audit: failedAudit });
      return NextResponse.json({ error: failureMessage(error), audit: failedAudit }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Qualitative request failed" }, { status: 500 });
  }
}
