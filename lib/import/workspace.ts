import { deduplicateLeads } from "../dedupe";
import { leadIdentity } from "../normalization";
import type { Lead } from "../../types/lead";
import type { ImportMode, ImportReport } from "../../types/import";

export function mergeImportedLeads(
  existing: Lead[],
  incoming: Lead[],
  mode: ImportMode,
  report: ImportReport,
) {
  if (mode === "REPLACE") {
    return {
      leads: incoming.map((lead) => ({ ...lead, isDevelopmentSample: false })),
      report: { ...report, added: incoming.length, duplicatesAgainstWorkspace: 0 },
    };
  }
  const existingKeys = new Set(existing.map((lead) => leadIdentity(lead)));
  const added = incoming.filter((lead) => !existingKeys.has(leadIdentity(lead)));
  const duplicateCounts = incoming.length - added.length;
  return {
    leads: [...existing, ...added.map((lead) => ({ ...lead, isDevelopmentSample: false }))],
    report: {
      ...report,
      added: added.length,
      duplicatesAgainstWorkspace: duplicateCounts,
      duplicatesFound: report.duplicatesFound + duplicateCounts,
    },
  };
}

export function normalizeAndDedupeWorkspace(leads: Lead[]) {
  return deduplicateLeads(leads).unique;
}
