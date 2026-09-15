import fs from "node:fs/promises";
import path from "node:path";
import type { AuditSignalName, WebsiteAudit } from "../types/audit";
import type { Lead } from "../types/lead";

const baseUrl = (process.env.DIGINest_PRODUCTION_URL ?? "https://diginest-lead-engine.vercel.app").replace(/\/$/, "");
const token = process.env.DIGINest_ADMIN_TOKEN;
const batchSize = Math.min(30, Math.max(1, Number(process.env.DIGINest_CALIBRATION_BATCH ?? 30)));
const selectionOffset = Math.max(0, Math.floor(Number(process.env.DIGINest_CALIBRATION_OFFSET ?? 0)));
const selectionManifestPath = process.env.DIGINest_CALIBRATION_MANIFEST;
const reportPath = process.env.DIGINest_CALIBRATION_REPORT ?? "C:\\tmp\\diginest-sprint-2a3-calibration.json";
const signalNames: AuditSignalName[] = [
  "phone",
  "whatsapp",
  "email",
  "booking",
  "contactForm",
  "reviews",
  "team",
  "services",
  "location",
  "googleMaps",
  "social",
];

type WorkspaceResponse = { mode: string; leads: Lead[] };

function categoryBucket(lead: Lead) {
  const value = `${lead.category} ${lead.name} ${lead.address}`.toLowerCase();
  if (/spa|beauty|wellness|salon|aesthetic|derma|skin|massage/.test(value)) return "wellness_beauty";
  if (/physio|physical|medical|clinic|hospital|doctor|health|therapy/.test(value)) return "physio_medical";
  if (/dent|orthodont|oral|dental/.test(value)) return "dental";
  return "other";
}

function hostname(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.toLowerCase();
  }
}

function selectCalibrationLeads(leads: Lead[], targetSize = batchSize) {
  const buckets = new Map<string, Lead[]>();
  for (const lead of leads) {
    if (!lead.hasWebsite || !lead.website) continue;
    const bucket = categoryBucket(lead);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), lead]);
  }
  const quotas: Record<string, number> = {
    dental: 12,
    physio_medical: 10,
    wellness_beauty: 5,
    other: 3,
  };
  const selected: Lead[] = [];
  const seenHosts = new Set<string>();
  for (const bucket of ["dental", "physio_medical", "wellness_beauty", "other"]) {
    for (const lead of buckets.get(bucket) ?? []) {
      if (selected.length >= targetSize || selected.filter((item) => categoryBucket(item) === bucket).length >= quotas[bucket]) break;
      const host = hostname(lead.website!);
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      selected.push(lead);
    }
  }
  if (selected.length < batchSize) {
    for (const lead of leads.filter((item) => item.hasWebsite && item.website)) {
      if (selected.length >= targetSize) break;
      const host = hostname(lead.website!);
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      selected.push(lead);
    }
  }
  return selected;
}

async function jsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

async function main() {
  if (!token) throw new Error("DIGINest_ADMIN_TOKEN is required");
  const workspaceResponse = await fetch(`${baseUrl}/api/workspace`);
  const workspace = (await jsonResponse(workspaceResponse)) as unknown as WorkspaceResponse;
  if (!workspaceResponse.ok) throw new Error(`Workspace GET failed: ${JSON.stringify(workspace)}`);
  if (workspace.mode !== "PRODUCTION") throw new Error(`Refusing calibration in ${workspace.mode} workspace`);
  if (workspace.leads.length !== 1212) throw new Error(`Expected 1212 production leads, found ${workspace.leads.length}`);
  let fullSelection: Lead[];
  if (selectionManifestPath) {
    const manifest = JSON.parse(await fs.readFile(selectionManifestPath, "utf8")) as {
      selection?: Array<{ leadId?: string }>;
    };
    const leadsById = new Map(workspace.leads.map((lead) => [lead.leadId, lead]));
    fullSelection = (manifest.selection ?? []).map((item) => leadsById.get(item.leadId ?? "")).filter((lead): lead is Lead => Boolean(lead));
  } else {
    fullSelection = selectCalibrationLeads(workspace.leads, selectionOffset + batchSize);
  }
  const selected = fullSelection.slice(selectionOffset, selectionOffset + batchSize);
  if (selected.length !== batchSize) throw new Error(`Could only select ${selected.length} unique-host website leads`);

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

  const startedBatch = Date.now();
  const results: Array<Record<string, unknown>> = [];
  for (const [index, lead] of selected.entries()) {
    const started = Date.now();
    const idempotencyKey = `sprint-2a3-2026-09-15-v4-${lead.leadId}`;
    console.log(`[${index + 1}/${selected.length}] ${lead.name} | ${lead.website}`);
    try {
      const response = await fetch(`${baseUrl}/api/audit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          leadId: lead.leadId,
          requestedUrl: lead.website,
          retryCount: (lead.audit.retryCount ?? 0) + 1,
          idempotencyKey,
        }),
      });
      const payload = await jsonResponse(response);
      const audit = payload.audit as WebsiteAudit | undefined;
      results.push({
        leadId: lead.leadId,
        business: lead.name,
        category: categoryBucket(lead),
        sourceCategory: lead.category,
        requestedUrl: lead.website,
        status: audit?.objectiveAuditStatus ?? audit?.status ?? "REQUEST_FAILED",
        qualitativeStatus: audit?.qualitativeAuditStatus,
        httpStatus: audit?.httpStatus,
        finalUrl: audit?.finalUrl,
        failureReason: audit?.failureReason,
        failureMessage: audit?.failureMessage,
        screenshotUploaded: Boolean(audit?.screenshotUrl),
        screenshotError: audit?.screenshotError,
        elapsedMs: Date.now() - started,
        responseStatus: response.status,
        idempotent: Boolean(payload.idempotent),
        detectedSignals: Object.fromEntries(signalNames.map((name) => [
          name,
          name === "reviews"
            ? Boolean(audit?.reviewsIndicators)
            : name === "team"
              ? Boolean(audit?.teamIndicators)
              : name === "services"
                ? Boolean(audit?.servicesIndicators)
                : name === "location"
                  ? Boolean(audit?.locationIndicators)
                  : name === "contactForm"
                    ? Boolean(audit?.contactFormFound)
                    : name === "googleMaps"
                      ? Boolean(audit?.googleMapsFound)
                      : name === "social"
                        ? Boolean(audit?.socialFound)
                        : Boolean(audit?.[`${name}Found` as keyof WebsiteAudit]),
        ])),
        signalEvidence: audit?.signalEvidence ?? {},
        responseError: response.ok ? undefined : payload.error,
      });
      if (!response.ok) console.log(`  request failed with HTTP ${response.status}`);
    } catch (error) {
      results.push({
        leadId: lead.leadId,
        business: lead.name,
        category: categoryBucket(lead),
        requestedUrl: lead.website,
        status: "REQUEST_FAILED",
        elapsedMs: Date.now() - started,
        responseError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const completed = results.filter((result) => result.status === "COMPLETE");
  const failed = results.filter((result) => result.status === "FAILED");
  const blocked = results.filter((result) => result.status === "BLOCKED");
  const signalCounts = Object.fromEntries(signalNames.map((name) => [name, 0]));
  const evidenceExamples: Partial<Record<AuditSignalName, unknown>> = {};
  for (const result of completed) {
    const signals = result.detectedSignals as Record<string, boolean>;
    for (const name of signalNames) {
      if (signals[name]) {
        signalCounts[name] += 1;
        const evidence = (result.signalEvidence as Record<string, unknown[]> | undefined)?.[name];
        if (!evidenceExamples[name] && evidence?.length) evidenceExamples[name] = evidence[0];
      }
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    workspaceMode: workspace.mode,
    productionLeadCount: workspace.leads.length,
    productionWebsiteLeadCount: workspace.leads.filter((lead) => lead.hasWebsite && lead.website).length,
    selectionOffset,
    selectionManifestPath,
    selection: selected.map((lead) => ({
      leadId: lead.leadId,
      business: lead.name,
      sourceCategory: lead.category,
      calibrationCategory: categoryBucket(lead),
      website: lead.website,
    })),
    attempted: results.length,
    completed: completed.length,
    failed: failed.length,
    blocked: blocked.length,
    retried: results.filter((result) => !result.idempotent).length,
    averageAuditTimeMs: results.length ? Math.round(results.reduce((sum, result) => sum + Number(result.elapsedMs ?? 0), 0) / results.length) : 0,
    durationsMs: results.map((result) => Number(result.elapsedMs ?? 0)).sort((a, b) => a - b),
    screenshotSuccessRate: completed.length ? completed.filter((result) => result.screenshotUploaded).length / completed.length : 0,
    signalsDetected: signalCounts,
    structuredEvidenceExamples: evidenceExamples,
    crawlerProblems: results.filter((result) => result.status === "FAILED" || result.status === "BLOCKED" || result.status === "REQUEST_FAILED"),
    results,
    batchElapsedMs: Date.now() - startedBatch,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
