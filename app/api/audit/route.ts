import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { crawlWebsite } from "@/lib/audit/crawler";
import { findProductionLead, getAuditResult, persistAuditResult, saveLead } from "@/lib/persistence/db";
import { checkRateLimit, isAuthorized } from "@/lib/security/auth";
import { uploadAuditScreenshot } from "@/lib/storage/screenshots";
import { transitionAuditStatus } from "@/lib/audit/state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!checkRateLimit(request)) return NextResponse.json({ error: "Audit rate limit exceeded" }, { status: 429 });
  try {
    const body = (await request.json()) as {
      leadId?: string;
      requestedUrl?: string;
      retryCount?: number;
      idempotencyKey?: string;
    };
    if (!body.leadId || !body.requestedUrl) {
      return NextResponse.json(
        { error: "leadId and requestedUrl are required" },
        { status: 400 },
      );
    }
    const lead = await findProductionLead(body.leadId);
    if (!lead || !lead.hasWebsite) return NextResponse.json({ error: "Production lead not found or has no website" }, { status: 404 });
    const retryCount = body.retryCount ?? (lead.audit.retryCount ?? 0) + 1;
    const key = body.idempotencyKey ?? `${body.leadId}:${body.requestedUrl}:${retryCount}`;
    const existingResult = await getAuditResult(key);
    if (existingResult) return NextResponse.json({ audit: existingResult, idempotent: true });
    const queued = transitionAuditStatus(lead.audit, "QUEUED");
    const startedAt = new Date().toISOString();
    const auditing = transitionAuditStatus({ ...queued, retryCount, startedAt, heartbeatAt: startedAt, lastAttemptAt: startedAt }, "AUDITING");
    await saveLead({ ...lead, audit: auditing });
    const audit = await crawlWebsite({
      leadId: body.leadId,
      requestedUrl: body.requestedUrl,
      retryCount,
    });
    let storedAudit = audit;
    if (audit.screenshotPath && audit.auditTimestamp) {
      try {
        const blob = await uploadAuditScreenshot(audit.screenshotPath, body.leadId, audit.auditTimestamp);
        storedAudit = { ...storedAudit, screenshotUrl: blob.url, screenshotPath: undefined };
      } catch (error) {
        storedAudit = { ...storedAudit, screenshotPath: undefined, screenshotError: error instanceof Error ? error.message.slice(0, 300) : "Screenshot upload failed" };
      } finally {
        await fs.rm(audit.screenshotPath, { force: true }).catch(() => undefined);
      }
    }
    await persistAuditResult({ ...lead, audit: auditing }, storedAudit, key);
    return NextResponse.json({ audit: storedAudit });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Audit request failed",
      },
      { status: 500 },
    );
  }
}
