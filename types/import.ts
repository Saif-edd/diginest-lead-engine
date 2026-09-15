import type { DedupeReasonCounts } from "../lib/dedupe";

export type ImportMode = "REPLACE" | "APPEND";

export interface ImportReport {
  rawRows: number;
  invalidRows: number;
  duplicatesFound: number;
  uniqueImported: number;
  withWebsite: number;
  noWebsite: number;
  duplicateReasonCounts: DedupeReasonCounts;
  added?: number;
  duplicatesAgainstWorkspace?: number;
}
