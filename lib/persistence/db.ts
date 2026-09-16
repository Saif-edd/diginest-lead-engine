import { createClient, type Client } from "@libsql/client";
import type { Lead, WorkspaceMode } from "@/types/lead";
import type { ImportReport } from "@/types/import";
import type { WebsiteAudit } from "@/types/audit";
import type { QualitativeResult } from "@/types/qualitative";
import type { PreviewRecord, PreviewConfig, PreviewStatus } from "@/types/preview";
import { leadIdentity } from "@/lib/normalization";
import { automaticQualificationFor, calculateLeadScore, effectiveQualificationFor } from "@/lib/scoring";
import { recoverStaleAudit } from "@/lib/audit/state";

let client: Client | undefined;
let schemaPromise: Promise<void> | undefined;

function database() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("Durable persistence is not configured: TURSO_DATABASE_URL is missing");
  client = createClient({ url, authToken });
  return client;
}

async function ensureSchema() {
  if (!schemaPromise) {
    const db = database();
    schemaPromise = db.batch([
      { sql: `CREATE TABLE IF NOT EXISTS leads (lead_id TEXT PRIMARY KEY, workspace_mode TEXT NOT NULL, lead_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`, args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_mode TEXT NOT NULL, source_file TEXT, report_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS audit_jobs (lead_id TEXT PRIMARY KEY, objective_status TEXT NOT NULL, qualitative_status TEXT NOT NULL, started_at TEXT, completed_at TEXT, heartbeat_at TEXT, retry_count INTEGER NOT NULL DEFAULT 0, audit_json TEXT NOT NULL, updated_at TEXT NOT NULL)`, args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS audit_results (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, audit_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS qualitative_results (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, result_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS preview_records (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'NOT_STARTED', vertical TEXT NOT NULL DEFAULT 'DENTAL', archetype TEXT NOT NULL, archetype_confidence TEXT NOT NULL, preview_depth TEXT NOT NULL, config_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ready_at TEXT)`, args: [] },
      { sql: `CREATE INDEX IF NOT EXISTS leads_mode_idx ON leads(workspace_mode)`, args: [] },
      { sql: `CREATE INDEX IF NOT EXISTS audit_results_lead_idx ON audit_results(lead_id)`, args: [] },
      { sql: `CREATE INDEX IF NOT EXISTS qualitative_results_lead_idx ON qualitative_results(lead_id)`, args: [] },
      { sql: `CREATE INDEX IF NOT EXISTS preview_records_lead_idx ON preview_records(lead_id)`, args: [] },
      { sql: `CREATE INDEX IF NOT EXISTS preview_records_slug_idx ON preview_records(slug)`, args: [] },
    ]).then(() => undefined);
  }
  await schemaPromise;
}

function now() { return new Date().toISOString(); }

function migrateLead(lead: Lead): Lead {
  const legacyStatus = lead.audit.status;
  const objectiveAuditStatus = lead.audit.objectiveAuditStatus ?? (legacyStatus === "NOT REQUIRED" ? "PENDING" : legacyStatus);
  const qualitativeAuditStatus = lead.audit.qualitativeAuditStatus ?? (objectiveAuditStatus === "COMPLETE" ? "PENDING" : "NOT_READY");
  const audit = recoverStaleAudit({ ...lead.audit, objectiveAuditStatus, qualitativeAuditStatus });
  const score = calculateLeadScore({ ...lead, audit });
  const automaticQualification = automaticQualificationFor({ hasWebsite: lead.hasWebsite, audit, score });
  return { ...lead, audit, score, automaticQualification, qualificationStatus: effectiveQualificationFor(lead.manualDecision, automaticQualification) };
}

export async function loadProductionWorkspace() {
  await ensureSchema();
  const db = database();
  const leadRows = await db.execute({ sql: "SELECT lead_json FROM leads WHERE workspace_mode = 'PRODUCTION' ORDER BY created_at", args: [] });
  const importRows = await db.execute({ sql: "SELECT report_json FROM imports WHERE workspace_mode = 'PRODUCTION' ORDER BY id DESC LIMIT 1", args: [] });
  return {
    mode: "PRODUCTION" as const,
    leads: leadRows.rows.map((row) => migrateLead(JSON.parse(String(row.lead_json)) as Lead)),
    lastImportReport: importRows.rows[0] ? JSON.parse(String(importRows.rows[0].report_json)) as ImportReport : null,
  };
}

export async function replaceProductionWorkspace(leads: Lead[], report: ImportReport) {
  await ensureSchema();
  const timestamp = now();
  const db = database();
  const statements = [
    { sql: "DELETE FROM audit_results", args: [] },
    { sql: "DELETE FROM qualitative_results", args: [] },
    { sql: "DELETE FROM audit_jobs", args: [] },
    { sql: "DELETE FROM leads WHERE workspace_mode = 'PRODUCTION'", args: [] },
    ...leads.map((lead) => ({ sql: "INSERT INTO leads (lead_id, workspace_mode, lead_json, created_at, updated_at) VALUES (?, 'PRODUCTION', ?, ?, ?)", args: [lead.leadId, JSON.stringify(lead), timestamp, timestamp] })),
    { sql: "INSERT INTO imports (workspace_mode, source_file, report_json, created_at) VALUES ('PRODUCTION', ?, ?, ?)", args: [leads[0]?.sourceFile ?? null, JSON.stringify(report), timestamp] },
  ];
  await db.batch(statements, "write");
  return loadProductionWorkspace();
}

export async function appendProductionWorkspace(leads: Lead[], report: ImportReport) {
  await ensureSchema();
  const existing = await loadProductionWorkspace();
  const existingKeys = new Set(existing.leads.map(leadIdentity));
  const added = leads.filter((lead) => !existingKeys.has(leadIdentity(lead)));
  const timestamp = now();
  const db = database();
  const statements = added.map((lead) => ({ sql: "INSERT INTO leads (lead_id, workspace_mode, lead_json, created_at, updated_at) VALUES (?, 'PRODUCTION', ?, ?, ?)", args: [lead.leadId, JSON.stringify({ ...lead, isDevelopmentSample: false }), timestamp, timestamp] }));
  statements.push({ sql: "INSERT INTO imports (workspace_mode, source_file, report_json, created_at) VALUES ('PRODUCTION', ?, ?, ?)", args: [leads[0]?.sourceFile ?? null, JSON.stringify({ ...report, added: added.length, duplicatesAgainstWorkspace: leads.length - added.length }), timestamp] });
  if (statements.length) await db.batch(statements, "write");
  return loadProductionWorkspace();
}

export async function clearProductionWorkspace() {
  await ensureSchema();
  await database().batch([
    { sql: "DELETE FROM audit_results", args: [] },
    { sql: "DELETE FROM qualitative_results", args: [] },
    { sql: "DELETE FROM audit_jobs", args: [] },
    { sql: "DELETE FROM leads WHERE workspace_mode = 'PRODUCTION'", args: [] },
  ], "write");
  return loadProductionWorkspace();
}

export async function saveLead(lead: Lead) {
  await ensureSchema();
  const timestamp = now();
  const migrated = migrateLead(lead);
  await database().batch([
    { sql: "INSERT INTO leads (lead_id, workspace_mode, lead_json, created_at, updated_at) VALUES (?, 'PRODUCTION', ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET lead_json = excluded.lead_json, updated_at = excluded.updated_at", args: [lead.leadId, JSON.stringify(migrated), timestamp, timestamp] },
    { sql: "INSERT INTO audit_jobs (lead_id, objective_status, qualitative_status, started_at, completed_at, heartbeat_at, retry_count, audit_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET objective_status = excluded.objective_status, qualitative_status = excluded.qualitative_status, started_at = excluded.started_at, completed_at = excluded.completed_at, heartbeat_at = excluded.heartbeat_at, retry_count = excluded.retry_count, audit_json = excluded.audit_json, updated_at = excluded.updated_at", args: [migrated.leadId, migrated.audit.objectiveAuditStatus ?? migrated.audit.status, migrated.audit.qualitativeAuditStatus ?? "NOT_READY", migrated.audit.startedAt ?? null, migrated.audit.completedAt ?? null, migrated.audit.heartbeatAt ?? null, migrated.audit.retryCount ?? 0, JSON.stringify(migrated.audit), timestamp] },
  ], "write");
}

export async function findProductionLead(leadId: string) {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT lead_json FROM leads WHERE lead_id = ? AND workspace_mode = 'PRODUCTION'", args: [leadId] });
  const row = result.rows[0];
  return row ? migrateLead(JSON.parse(String(row.lead_json)) as Lead) : undefined;
}

export async function persistAuditResult(lead: Lead, audit: WebsiteAudit, idempotencyKey: string) {
  await ensureSchema();
  const db = database();
  const existing = await db.execute({ sql: "SELECT audit_json FROM audit_results WHERE idempotency_key = ?", args: [idempotencyKey] });
  if (existing.rows[0]) return JSON.parse(String(existing.rows[0].audit_json)) as WebsiteAudit;
  const timestamp = now();
  await db.batch([
    { sql: "INSERT OR IGNORE INTO audit_results (lead_id, idempotency_key, audit_json, created_at) VALUES (?, ?, ?, ?)", args: [lead.leadId, idempotencyKey, JSON.stringify(audit), timestamp] },
    { sql: "INSERT INTO audit_jobs (lead_id, objective_status, qualitative_status, started_at, completed_at, heartbeat_at, retry_count, audit_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET objective_status = excluded.objective_status, qualitative_status = excluded.qualitative_status, started_at = excluded.started_at, completed_at = excluded.completed_at, heartbeat_at = excluded.heartbeat_at, retry_count = excluded.retry_count, audit_json = excluded.audit_json, updated_at = excluded.updated_at", args: [lead.leadId, audit.objectiveAuditStatus ?? audit.status, audit.qualitativeAuditStatus ?? "NOT_READY", audit.startedAt ?? null, audit.completedAt ?? null, audit.heartbeatAt ?? null, audit.retryCount ?? 0, JSON.stringify(audit), timestamp] },
    { sql: "UPDATE leads SET lead_json = ?, updated_at = ? WHERE lead_id = ? AND workspace_mode = 'PRODUCTION'", args: [JSON.stringify({ ...lead, audit }), timestamp, lead.leadId] },
  ], "write");
  return audit;
}

export async function getAuditResult(idempotencyKey: string) {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT audit_json FROM audit_results WHERE idempotency_key = ?", args: [idempotencyKey] });
  return result.rows[0] ? JSON.parse(String(result.rows[0].audit_json)) as WebsiteAudit : undefined;
}

export async function persistQualitativeResult(
  lead: Lead,
  audit: WebsiteAudit,
  result: QualitativeResult,
  idempotencyKey: string,
) {
  await ensureSchema();
  const db = database();
  const existing = await db.execute({ sql: "SELECT result_json FROM qualitative_results WHERE idempotency_key = ?", args: [idempotencyKey] });
  if (existing.rows[0]) return JSON.parse(String(existing.rows[0].result_json)) as QualitativeResult;
  const timestamp = now();
  await db.batch([
    { sql: "INSERT OR IGNORE INTO qualitative_results (lead_id, idempotency_key, result_json, created_at) VALUES (?, ?, ?, ?)", args: [lead.leadId, idempotencyKey, JSON.stringify(result), timestamp] },
    { sql: "UPDATE audit_jobs SET qualitative_status = ?, audit_json = ?, updated_at = ? WHERE lead_id = ?", args: [audit.qualitativeAuditStatus ?? "COMPLETE", JSON.stringify(audit), timestamp, lead.leadId] },
    { sql: "UPDATE leads SET lead_json = ?, updated_at = ? WHERE lead_id = ? AND workspace_mode = 'PRODUCTION'", args: [JSON.stringify(migrateLead({ ...lead, audit })), timestamp, lead.leadId] },
  ], "write");
  const stored = await db.execute({ sql: "SELECT result_json FROM qualitative_results WHERE idempotency_key = ?", args: [idempotencyKey] });
  return stored.rows[0] ? JSON.parse(String(stored.rows[0].result_json)) as QualitativeResult : result;
}

export async function getQualitativeResult(idempotencyKey: string) {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT result_json FROM qualitative_results WHERE idempotency_key = ?", args: [idempotencyKey] });
  return result.rows[0] ? JSON.parse(String(result.rows[0].result_json)) as QualitativeResult : undefined;
}

// ============================================================
// Preview Records
// ============================================================

function rowToPreviewRecord(row: Record<string, unknown>): PreviewRecord {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    slug: String(row.slug),
    status: String(row.status) as PreviewStatus,
    vertical: "DENTAL",
    archetype: String(row.archetype) as PreviewRecord["archetype"],
    archetypeConfidence: String(row.archetype_confidence) as PreviewRecord["archetypeConfidence"],
    previewDepth: String(row.preview_depth) as PreviewRecord["previewDepth"],
    configJson: JSON.parse(String(row.config_json)) as PreviewConfig,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    readyAt: row.ready_at ? String(row.ready_at) : null,
  };
}

export async function upsertPreviewRecord(record: Omit<PreviewRecord, "createdAt" | "updatedAt" | "readyAt">): Promise<PreviewRecord> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: `INSERT INTO preview_records (id, lead_id, slug, status, vertical, archetype, archetype_confidence, preview_depth, config_json, created_at, updated_at, ready_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET
            slug = excluded.slug,
            status = excluded.status,
            archetype = excluded.archetype,
            archetype_confidence = excluded.archetype_confidence,
            preview_depth = excluded.preview_depth,
            config_json = excluded.config_json,
            updated_at = excluded.updated_at`,
    args: [
      record.id,
      record.leadId,
      record.slug,
      record.status,
      record.vertical,
      record.archetype,
      record.archetypeConfidence,
      record.previewDepth,
      JSON.stringify(record.configJson),
      timestamp,
      timestamp,
    ],
  });
  const inserted = await database().execute({ sql: "SELECT * FROM preview_records WHERE id = ?", args: [record.id] });
  return rowToPreviewRecord(inserted.rows[0] as Record<string, unknown>);
}

export async function updatePreviewStatus(id: string, status: PreviewStatus): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  const readyAt = status === "READY" ? timestamp : null;
  await database().execute({
    sql: "UPDATE preview_records SET status = ?, updated_at = ?, ready_at = COALESCE(?, ready_at) WHERE id = ?",
    args: [status, timestamp, readyAt, id],
  });
}

export async function findPreviewByLeadId(leadId: string): Promise<PreviewRecord | null> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", args: [leadId] });
  return result.rows[0] ? rowToPreviewRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function findPreviewBySlug(slug: string): Promise<PreviewRecord | null> {
  await ensureSchema();
  // slug stored as full path e.g. "/dentist/vision-dental-abu-dhabi"
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE slug = ?", args: [slug] });
  return result.rows[0] ? rowToPreviewRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function listReadyPreviews(): Promise<PreviewRecord[]> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE status = 'READY' ORDER BY ready_at DESC", args: [] });
  return result.rows.map((r) => rowToPreviewRecord(r as Record<string, unknown>));
}

export async function listAllPreviews(): Promise<PreviewRecord[]> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records ORDER BY created_at DESC", args: [] });
  return result.rows.map((r) => rowToPreviewRecord(r as Record<string, unknown>));
}
