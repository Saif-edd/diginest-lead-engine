import fs from "node:fs/promises";
import path from "node:path";
import type { WebsiteAudit } from "../types/audit";
import type { Lead } from "../types/lead";
import type { QualitativeResult } from "../types/qualitative";

const baseUrl = (process.env.DIGINest_PRODUCTION_URL ?? "https://diginest-lead-engine.vercel.app").replace(/\/$/, "");
const token = process.env.DIGINEST_ADMIN_TOKEN;
const batchSize = Math.min(20, Math.max(1, Number(process.env.DIGINest_QUALITATIVE_BATCH ?? 20)));
const reportPath = process.env.DIGINest_QUALITATIVE_REPORT ?? "C:\\tmp\\diginest-sprint-2b-calibration.json";

function categoryBucket(lead: Lead) {
  const value = `${lead.category} ${lead.name} ${lead.address}`.toLowerCase();
  if (/spa|beauty|wellness|salon|aesthetic|derma|skin|massage/.test(value)) return "wellness_beauty";
  if (/physio|physical|medical|clinic|hospital|doctor|health|therapy|rehab/.test(value)) return "physio_medical";
  if (/dent|orthodont|oral|dental/.test(value)) return "dental";
  return "other";
}

function host(website: string) {
  try { return new URL(website).hostname.replace(/^www\./, "").toLowerCase(); } catch { return website.toLowerCase(); }
}

function signalProfile(lead: Lead) {
  const audit = lead.audit;
  return [
    Boolean(audit.bookingFound),
    Boolean(audit.reviewsIndicators),
    Boolean(audit.teamIndicators),
    Boolean(audit.whatsappFound),
  ].filter(Boolean).length;
}

function selectLeads(leads: Lead[]) {
  const candidates = leads.filter((lead) => lead.hasWebsite && lead.website && (lead.audit.objectiveAuditStatus ?? lead.audit.status) === "COMPLETE");
  const quotas: Record<string, number> = { dental: 8, physio_medical: 6, wellness_beauty: 4, other: 2 };
  const selected: Lead[] = [];
  const seenHosts = new Set<string>();
  for (const bucket of Object.keys(quotas)) {
    const group = candidates
      .filter((lead) => categoryBucket(lead) === bucket)
      .sort((left, right) => signalProfile(left) - signalProfile(right) || (left.totalRatings ?? 0) - (right.totalRatings ?? 0));
    for (const lead of group) {
      if (selected.length >= batchSize || selected.filter((item) => categoryBucket(item) === bucket).length >= quotas[bucket]) break;
      const websiteHost = host(lead.website!);
      if (seenHosts.has(websiteHost)) continue;
      seenHosts.add(websiteHost);
      selected.push(lead);
    }
  }
  for (const lead of candidates) {
    if (selected.length >= batchSize) break;
    const websiteHost = host(lead.website!);
    if (seenHosts.has(websiteHost)) continue;
    seenHosts.add(websiteHost);
    selected.push(lead);
  }
  return selected.slice(0, batchSize);
}

async function jsonResponse(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return { error: text.slice(0, 500) }; }
}

async function main() {
  if (!token) throw new Error("DIGINEST_ADMIN_TOKEN is required");
  const workspaceResponse = await fetch(`${baseUrl}/api/workspace`);
  const workspace = await jsonResponse(workspaceResponse) as unknown as { mode: string; leads: Lead[] };
  if (!workspaceResponse.ok) throw new Error(`Workspace GET failed: ${JSON.stringify(workspace)}`);
  if (workspace.mode !== "PRODUCTION") throw new Error(`Refusing calibration in ${workspace.mode} workspace`);
  if (workspace.leads.length !== 1212) throw new Error(`Expected 1212 production leads, found ${workspace.leads.length}`);
  const selected = selectLeads(workspace.leads);
  if (selected.length !== batchSize) throw new Error(`Could only select ${selected.length} completed unique-host leads`);

  const authResponse = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const auth = await jsonResponse(authResponse);
  if (!authResponse.ok) throw new Error(`Admin auth failed: ${JSON.stringify(auth)}`);
  const setCookie = authResponse.headers.get("set-cookie");
  if (!setCookie) throw new Error("Admin auth did not return a session cookie");
  const cookie = setCookie.split(";", 1)[0];

  const results: Array<Record<string, unknown>> = [];
  for (const [index, lead] of selected.entries()) {
    const started = Date.now();
    const retryCount = (lead.audit.qualitativeRetryCount ?? 0) + 1;
    const key = `sprint-2b-v1-${lead.leadId}-${lead.audit.auditTimestamp ?? "audit"}-${retryCount}`;
    console.log(`[${index + 1}/${selected.length}] ${lead.name} | ${lead.website}`);
    try {
      const response = await fetch(`${baseUrl}/api/qualitative`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ leadId: lead.leadId, retryCount, idempotencyKey: key }),
      });
      const payload = await jsonResponse(response);
      const result = payload.result as QualitativeResult | undefined;
      const audit = payload.audit as WebsiteAudit | undefined;
      results.push({
        leadId: lead.leadId,
        business: lead.name,
        sourceCategory: lead.category,
        calibrationCategory: categoryBucket(lead),
        website: lead.website,
        objectiveStatus: audit?.objectiveAuditStatus ?? lead.audit.objectiveAuditStatus,
        qualitativeStatus: audit?.qualitativeAuditStatus,
        websiteOpportunityScore: result?.websiteOpportunityScore,
        opportunityGate: result?.opportunityGate,
        qualificationDecision: result?.qualificationDecision,
        mainProblem: result?.mainProblem,
        mainProblemSeverity: result?.mainProblemSeverity,
        recommendedPreviewDepth: result?.recommendedPreviewDepth,
        modelVersion: result?.modelVersion,
        elapsedMs: Date.now() - started,
        responseStatus: response.status,
        idempotent: Boolean(payload.idempotent),
        error: response.ok ? undefined : payload.error,
      });
    } catch (error) {
      results.push({ leadId: lead.leadId, business: lead.name, website: lead.website, responseStatus: 0, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const completed = results.filter((result) => result.qualitativeStatus === "COMPLETE");
  const failed = results.filter((result) => result.qualitativeStatus === "FAILED" || result.responseStatus === 502);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    workspaceMode: workspace.mode,
    productionLeadCount: workspace.leads.length,
    productionWebsiteLeadCount: workspace.leads.filter((lead) => lead.hasWebsite && lead.website).length,
    batchSize,
    selection: selected.map((lead) => ({ leadId: lead.leadId, business: lead.name, category: lead.category, calibrationCategory: categoryBucket(lead), website: lead.website, reviewCount: lead.totalRatings, signalProfile: signalProfile(lead) })),
    attempted: results.length,
    completed: completed.length,
    failed: failed.length,
    averageAnalysisTimeMs: results.length ? Math.round(results.reduce((sum, result) => sum + Number(result.elapsedMs ?? 0), 0) / results.length) : 0,
    results,
    manualQa: "Complete the required 10-site manual review before marking Sprint 2B ready.",
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
