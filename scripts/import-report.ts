import fs from "node:fs";
import path from "node:path";
import { deduplicateLeads } from "../lib/dedupe";
import { parseCsv } from "../lib/import/csv";
import { normalizeRows } from "../lib/normalization";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run report:csv -- <path-to-csv>");
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
const rows = parseCsv(fs.readFileSync(absolutePath, "utf8"));
const normalized = normalizeRows(rows, path.basename(absolutePath));
const deduped = deduplicateLeads(normalized.leads);

console.log(JSON.stringify({
  file: absolutePath,
  rawRows: rows.length,
  invalidRows: normalized.errors.length,
  duplicatesFound: deduped.duplicates.length,
  uniqueLeads: deduped.unique.length,
  withWebsite: deduped.unique.filter((lead) => lead.hasWebsite).length,
  noWebsite: deduped.unique.filter((lead) => !lead.hasWebsite).length,
  duplicateReasonCounts: deduped.duplicateReasonCounts,
}, null, 2));
