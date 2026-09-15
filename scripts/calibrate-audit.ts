import fs from "node:fs";
import path from "node:path";
import { crawlWebsite } from "../lib/audit/crawler";
import { deduplicateLeads } from "../lib/dedupe";
import { parseCsv } from "../lib/import/csv";
import { normalizeRows } from "../lib/normalization";

const filePath = process.argv[2];
const requestedBatch = Number(
  process.argv[3] ?? process.env.DIGINest_AUDIT_BATCH ?? 20,
);
const batchSize = Number.isFinite(requestedBatch)
  ? Math.min(30, Math.max(1, Math.floor(requestedBatch)))
  : 20;

if (!filePath) {
  console.error(
    "Usage: npx tsx scripts/calibrate-audit.ts <path-to-csv> [batch-size]",
  );
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
const rows = parseCsv(fs.readFileSync(absolutePath, "utf8"));
const normalized = normalizeRows(rows, path.basename(absolutePath));
const deduped = deduplicateLeads(normalized.leads);
const candidates = deduped.unique
  .filter((lead) => lead.hasWebsite && lead.website)
  .slice(0, batchSize);

const signalNames = [
  "phoneFound",
  "whatsappFound",
  "emailFound",
  "bookingFound",
  "contactFormFound",
  "googleMapsFound",
  "socialFound",
  "reviewsIndicators",
  "teamIndicators",
  "servicesIndicators",
  "locationIndicators",
] as const;

async function main() {
  const startedBatch = Date.now();
  const results: Array<{
    leadId: string;
    business: string;
    requestedUrl: string;
    status: string;
    failureReason?: string;
    failureMessage?: string;
    elapsedMs: number;
    screenshotPath?: string;
    detectedSignals: Partial<Record<(typeof signalNames)[number], boolean>>;
  }> = [];

  for (const [index, lead] of candidates.entries()) {
    const started = Date.now();
    console.log(
      `[${index + 1}/${candidates.length}] ${lead.name} — ${lead.website}`,
    );
    const audit = await crawlWebsite({
      leadId: lead.leadId,
      requestedUrl: lead.website!,
      retryCount: 1,
      timeoutMs: 20_000,
    });
    results.push({
      leadId: lead.leadId,
      business: lead.name,
      requestedUrl: lead.website!,
      status: audit.status,
      failureReason: audit.failureReason,
      failureMessage: audit.failureMessage,
      elapsedMs: Date.now() - started,
      screenshotPath: audit.screenshotPath,
      detectedSignals: {
        phoneFound: audit.phoneFound,
        whatsappFound: audit.whatsappFound,
        emailFound: audit.emailFound,
        bookingFound: audit.bookingFound,
        contactFormFound: audit.contactFormFound,
        googleMapsFound: audit.googleMapsFound,
        socialFound: audit.socialFound,
        reviewsIndicators: audit.reviewsIndicators,
        teamIndicators: audit.teamIndicators,
        servicesIndicators: audit.servicesIndicators,
        locationIndicators: audit.locationIndicators,
      },
    });
  }

  const completed = results.filter((result) => result.status === "COMPLETE");
  const failed = results.filter((result) => result.status === "FAILED");
  const blocked = results.filter((result) => result.status === "BLOCKED");
  const signalCounts = Object.fromEntries(signalNames.map((name) => [name, 0]));
  for (const result of completed) {
    for (const name of signalNames) {
      if (result.detectedSignals[name]) signalCounts[name] += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        file: absolutePath,
        rawRows: rows.length,
        invalidRows: normalized.errors.length,
        duplicatesRemoved: deduped.duplicates.length,
        uniqueImported: deduped.unique.length,
        withWebsite: deduped.unique.filter((lead) => lead.hasWebsite).length,
        noWebsite: deduped.unique.filter((lead) => !lead.hasWebsite).length,
        duplicateReasonCounts: deduped.duplicateReasonCounts,
        batchSize,
        attempted: results.length,
        completed: completed.length,
        failed: failed.length,
        blocked: blocked.length,
        averageAuditTimeMs: results.length
          ? Math.round(
              results.reduce((sum, result) => sum + result.elapsedMs, 0) /
                results.length,
            )
          : 0,
        batchElapsedMs: Date.now() - startedBatch,
        signalsDetected: signalCounts,
        crawlerProblems: [...failed, ...blocked].map(
          ({ leadId, business, failureReason, failureMessage }) => ({
            leadId,
            business,
            failureReason,
            failureMessage,
          }),
        ),
        examples: completed.slice(0, 3),
      },
      null,
      2,
    ),
  );
}

void main();
