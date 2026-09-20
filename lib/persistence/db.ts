import { createClient, type Client } from "@libsql/client";
import type { Lead, WorkspaceMode } from "@/types/lead";
import type { ImportReport } from "@/types/import";
import type { WebsiteAudit } from "@/types/audit";
import type { QualitativeResult } from "@/types/qualitative";
import type {
  PreviewRecord,
  PreviewConfig,
  PreviewStatus,
  V0WorkflowStatus,
  VerifiedFactsBlock,
  PreviewAssetPack,
  V0PromptPack,
} from "@/types/preview";
import type { OutreachRecord, OutreachRecordStatus, OutreachChannel } from "@/types/outreach";
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
    schemaPromise = (async () => {
      // Core tables
      await db.batch([
        { sql: `CREATE TABLE IF NOT EXISTS leads (lead_id TEXT PRIMARY KEY, workspace_mode TEXT NOT NULL, lead_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`, args: [] },
        { sql: `CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_mode TEXT NOT NULL, source_file TEXT, report_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
        { sql: `CREATE TABLE IF NOT EXISTS audit_jobs (lead_id TEXT PRIMARY KEY, objective_status TEXT NOT NULL, qualitative_status TEXT NOT NULL, started_at TEXT, completed_at TEXT, heartbeat_at TEXT, retry_count INTEGER NOT NULL DEFAULT 0, audit_json TEXT NOT NULL, updated_at TEXT NOT NULL)`, args: [] },
        { sql: `CREATE TABLE IF NOT EXISTS audit_results (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, audit_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
        { sql: `CREATE TABLE IF NOT EXISTS qualitative_results (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, result_json TEXT NOT NULL, created_at TEXT NOT NULL)`, args: [] },
        {
          sql: `CREATE TABLE IF NOT EXISTS preview_records (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'NOT_STARTED',
            vertical TEXT NOT NULL DEFAULT 'DENTAL',
            archetype TEXT NOT NULL,
            archetype_confidence TEXT NOT NULL,
            preview_depth TEXT NOT NULL,
            config_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            ready_at TEXT
          )`,
          args: [],
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS outreach_records (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL UNIQUE,
            preview_id TEXT NOT NULL,
            final_preview_url TEXT NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NOT_STARTED',
            hook TEXT,
            message TEXT,
            subject TEXT,
            prospect_timezone TEXT,
            timezone_source TEXT,
            timezone_confidence TEXT,
            follow_up_count INTEGER NOT NULL DEFAULT 0,
            last_contacted_at TEXT,
            next_follow_up_at TEXT,
            replied_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          args: [],
        },
        { sql: `CREATE INDEX IF NOT EXISTS leads_mode_idx ON leads(workspace_mode)`, args: [] },
        { sql: `CREATE INDEX IF NOT EXISTS audit_results_lead_idx ON audit_results(lead_id)`, args: [] },
        { sql: `CREATE INDEX IF NOT EXISTS qualitative_results_lead_idx ON qualitative_results(lead_id)`, args: [] },
        { sql: `CREATE INDEX IF NOT EXISTS preview_records_lead_idx ON preview_records(lead_id)`, args: [] },
        { sql: `CREATE INDEX IF NOT EXISTS preview_records_slug_idx ON preview_records(slug)`, args: [] },
      ]);

      // Sprint 3A additive migration – new columns on preview_records
      // ALTER TABLE IF NOT EXISTS is not supported by SQLite; use try/catch per column
      const sprint3aColumns = [
        `ALTER TABLE preview_records ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'NOT_STARTED'`,
        `ALTER TABLE preview_records ADD COLUMN final_preview_url TEXT`,
        `ALTER TABLE preview_records ADD COLUMN preview_provider TEXT`,
        `ALTER TABLE preview_records ADD COLUMN preview_added_at TEXT`,
        `ALTER TABLE preview_records ADD COLUMN v0_prompt_json TEXT`,
        `ALTER TABLE preview_records ADD COLUMN asset_pack_json TEXT`,
        `ALTER TABLE preview_records ADD COLUMN verified_facts_json TEXT`,
      ];

      for (const sql of sprint3aColumns) {
        try {
          await db.execute({ sql, args: [] });
        } catch {
          // Column already exists – safe to ignore duplicate-column error
        }
      }

      // Sprint 3B.1 additive migration – copy variant tracking on outreach_records
      const sprint3b1Columns = [
        `ALTER TABLE outreach_records ADD COLUMN copy_variant TEXT`,
        `ALTER TABLE outreach_records ADD COLUMN subject_variant_id TEXT`,
        `ALTER TABLE outreach_records ADD COLUMN message_variant_id TEXT`,
      ];

      for (const sql of sprint3b1Columns) {
        try {
          await db.execute({ sql, args: [] });
        } catch {
          // Column already exists – safe to ignore
        }
      }
    })();
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
    { sql: "DELETE FROM outreach_records WHERE lead_id IN (SELECT lead_id FROM leads WHERE workspace_mode = 'PRODUCTION')", args: [] },
    { sql: "DELETE FROM preview_records WHERE lead_id IN (SELECT lead_id FROM leads WHERE workspace_mode = 'PRODUCTION')", args: [] },
    { sql: "DELETE FROM audit_results WHERE lead_id IN (SELECT lead_id FROM leads WHERE workspace_mode = 'PRODUCTION')", args: [] },
    { sql: "DELETE FROM qualitative_results WHERE lead_id IN (SELECT lead_id FROM leads WHERE workspace_mode = 'PRODUCTION')", args: [] },
    { sql: "DELETE FROM audit_jobs WHERE lead_id IN (SELECT lead_id FROM leads WHERE workspace_mode = 'PRODUCTION')", args: [] },
    { sql: "DELETE FROM imports WHERE workspace_mode = 'PRODUCTION'", args: [] },
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
// Preview Records – Sprint 3A
// ============================================================

function parseJsonSafe<T>(val: unknown): T | null {
  if (!val) return null;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return null;
  }
}

function rowToPreviewRecord(row: Record<string, unknown>): PreviewRecord {
  // Determine workflowStatus: use workflow_status column if it exists and is a known V0 status,
  // otherwise derive from legacy status for backward compat
  const rawWorkflow = String(row.workflow_status ?? "NOT_STARTED");
  const workflowStatus: V0WorkflowStatus = [
    "NOT_STARTED",
    "BRIEF_READY",
    "PROMPT_READY",
    "IN_V0",
    "PREVIEW_LINK_ADDED",
    "READY_FOR_OUTREACH",
    "ARCHIVED",
  ].includes(rawWorkflow)
    ? (rawWorkflow as V0WorkflowStatus)
    : "NOT_STARTED";

  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    slug: String(row.slug),
    status: String(row.status) as PreviewStatus,
    workflowStatus,
    vertical: "DENTAL",
    archetype: String(row.archetype) as PreviewRecord["archetype"],
    archetypeConfidence: String(row.archetype_confidence) as PreviewRecord["archetypeConfidence"],
    previewDepth: String(row.preview_depth) as PreviewRecord["previewDepth"],
    configJson: parseJsonSafe<PreviewConfig>(row.config_json) ?? ({} as PreviewConfig),
    verifiedFacts: parseJsonSafe<VerifiedFactsBlock>(row.verified_facts_json),
    assetPack: parseJsonSafe<PreviewAssetPack>(row.asset_pack_json),
    v0PromptPack: parseJsonSafe<V0PromptPack>(row.v0_prompt_json),
    finalPreviewUrl: row.final_preview_url ? String(row.final_preview_url) : null,
    previewProvider: row.preview_provider
      ? (String(row.preview_provider) as PreviewRecord["previewProvider"])
      : null,
    previewAddedAt: row.preview_added_at ? String(row.preview_added_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    readyAt: row.ready_at ? String(row.ready_at) : null,
  };
}

// ---------------------------------------------------------------
// URL validation for final preview URL
// ---------------------------------------------------------------

export function validatePreviewUrl(url: string): boolean {
  if (!url || url.length < 10 || url.length > 500) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------

export async function upsertPreviewRecord(
  record: Omit<PreviewRecord, "createdAt" | "updatedAt" | "readyAt" | "verifiedFacts" | "assetPack" | "v0PromptPack" | "finalPreviewUrl" | "previewProvider" | "previewAddedAt">,
): Promise<PreviewRecord> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: `INSERT INTO preview_records (id, lead_id, slug, status, workflow_status, vertical, archetype, archetype_confidence, preview_depth, config_json, created_at, updated_at, ready_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET
            slug = excluded.slug,
            status = excluded.status,
            workflow_status = excluded.workflow_status,
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
      record.workflowStatus,
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

/** Update only the workflow status (and optionally ready_at). */
export async function updatePreviewWorkflowStatus(
  id: string,
  workflowStatus: V0WorkflowStatus,
): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  const readyAt = workflowStatus === "READY_FOR_OUTREACH" ? timestamp : null;
  await database().execute({
    sql: "UPDATE preview_records SET workflow_status = ?, status = ?, updated_at = ?, ready_at = COALESCE(?, ready_at) WHERE id = ?",
    args: [workflowStatus, workflowStatus, timestamp, readyAt, id],
  });
}

/** Legacy status update – kept for backward compat. */
export async function updatePreviewStatus(id: string, status: PreviewStatus): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  const readyAt = status === "READY" ? timestamp : null;
  await database().execute({
    sql: "UPDATE preview_records SET status = ?, updated_at = ?, ready_at = COALESCE(?, ready_at) WHERE id = ?",
    args: [status, timestamp, readyAt, id],
  });
}

/** Store the verified facts + asset pack (sets BRIEF_READY). */
export async function setPreviewBrief(
  id: string,
  verifiedFacts: VerifiedFactsBlock,
  assetPack: PreviewAssetPack,
): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: "UPDATE preview_records SET verified_facts_json = ?, asset_pack_json = ?, workflow_status = 'BRIEF_READY', status = 'BRIEF_READY', updated_at = ? WHERE id = ?",
    args: [JSON.stringify(verifiedFacts), JSON.stringify(assetPack), timestamp, id],
  });
}

/** Store the V0 prompt pack (sets PROMPT_READY). */
export async function setPreviewV0Pack(
  id: string,
  v0PromptPack: V0PromptPack,
): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: "UPDATE preview_records SET v0_prompt_json = ?, workflow_status = 'PROMPT_READY', status = 'PROMPT_READY', updated_at = ? WHERE id = ?",
    args: [JSON.stringify(v0PromptPack), timestamp, id],
  });
}

/** Validate and store the final preview URL (sets PREVIEW_LINK_ADDED). */
export async function setFinalPreviewUrl(
  id: string,
  url: string,
  provider: "V0" | "LEGACY" = "V0",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validatePreviewUrl(url)) {
    return { ok: false, error: "Invalid URL: must be a valid http(s) URL under 500 characters" };
  }
  await ensureSchema();
  const timestamp = now();
  const result = await database().execute({
    sql: "UPDATE preview_records SET final_preview_url = ?, preview_provider = ?, preview_added_at = ?, workflow_status = 'PREVIEW_LINK_ADDED', status = 'PREVIEW_LINK_ADDED', updated_at = ? WHERE id = ?",
    args: [url, provider, timestamp, timestamp, id],
  });
  if (result.rowsAffected === 0) {
    return { ok: false, error: "Preview record not found" };
  }
  return { ok: true };
}

/** Mark ready for outreach – explicit admin-only action. Does NOT auto-trigger. */
export async function markReadyForOutreach(id: string): Promise<void> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: "UPDATE preview_records SET workflow_status = 'READY_FOR_OUTREACH', status = 'READY_FOR_OUTREACH', ready_at = ?, updated_at = ? WHERE id = ?",
    args: [timestamp, timestamp, id],
  });
}

export async function findPreviewByLeadId(leadId: string): Promise<PreviewRecord | null> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", args: [leadId] });
  return result.rows[0] ? rowToPreviewRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function findPreviewById(id: string): Promise<PreviewRecord | null> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE id = ?", args: [id] });
  return result.rows[0] ? rowToPreviewRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function findPreviewBySlug(slug: string): Promise<PreviewRecord | null> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE slug = ?", args: [slug] });
  return result.rows[0] ? rowToPreviewRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function listReadyPreviews(): Promise<PreviewRecord[]> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records WHERE status IN ('READY', 'READY_FOR_OUTREACH') OR workflow_status = 'READY_FOR_OUTREACH' ORDER BY ready_at DESC", args: [] });
  return result.rows.map((r) => rowToPreviewRecord(r as Record<string, unknown>));
}

export async function listAllPreviews(): Promise<PreviewRecord[]> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM preview_records ORDER BY created_at DESC", args: [] });
  return result.rows.map((r) => rowToPreviewRecord(r as Record<string, unknown>));
}

// ---------------------------------------------------------------
// Outreach Records
// ---------------------------------------------------------------

function rowToOutreachRecord(row: Record<string, unknown>): OutreachRecord {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    previewId: String(row.preview_id),
    finalPreviewUrl: String(row.final_preview_url),
    channel: String(row.channel) as OutreachChannel,
    status: String(row.status) as OutreachRecordStatus,
    hook: row.hook ? String(row.hook) : null,
    message: row.message ? String(row.message) : null,
    subject: row.subject ? String(row.subject) : null,
    copyVariant: row.copy_variant ? String(row.copy_variant) as import("@/types/outreach").CopyVariant : null,
    subjectVariantId: row.subject_variant_id ? String(row.subject_variant_id) : null,
    messageVariantId: row.message_variant_id ? String(row.message_variant_id) : null,
    prospectTimezone: row.prospect_timezone ? String(row.prospect_timezone) : null,
    timezoneSource: row.timezone_source ? String(row.timezone_source) as "DERIVED" | "MANUAL" : null,
    timezoneConfidence: row.timezone_confidence ? String(row.timezone_confidence) as "HIGH" | "MEDIUM" | "LOW" : null,
    followUpCount: Number(row.follow_up_count),
    lastContactedAt: row.last_contacted_at ? String(row.last_contacted_at) : null,
    nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
    repliedAt: row.replied_at ? String(row.replied_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}


export async function upsertOutreachRecord(
  record: Omit<OutreachRecord, "createdAt" | "updatedAt">
): Promise<OutreachRecord> {
  await ensureSchema();
  const timestamp = now();
  await database().execute({
    sql: `INSERT INTO outreach_records (
            id, lead_id, preview_id, final_preview_url, channel, status, 
            hook, message, subject, copy_variant, subject_variant_id, message_variant_id,
            prospect_timezone, timezone_source, timezone_confidence,
            follow_up_count, last_contacted_at, next_follow_up_at, replied_at,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(lead_id) DO UPDATE SET
            channel = excluded.channel,
            status = excluded.status,
            hook = excluded.hook,
            message = excluded.message,
            subject = excluded.subject,
            copy_variant = excluded.copy_variant,
            subject_variant_id = excluded.subject_variant_id,
            message_variant_id = excluded.message_variant_id,
            prospect_timezone = excluded.prospect_timezone,
            timezone_source = excluded.timezone_source,
            timezone_confidence = excluded.timezone_confidence,
            follow_up_count = excluded.follow_up_count,
            last_contacted_at = excluded.last_contacted_at,
            next_follow_up_at = excluded.next_follow_up_at,
            replied_at = excluded.replied_at,
            updated_at = excluded.updated_at`,
    args: [
      record.id, record.leadId, record.previewId, record.finalPreviewUrl, record.channel, record.status,
      record.hook, record.message, record.subject,
      record.copyVariant ?? null, record.subjectVariantId ?? null, record.messageVariantId ?? null,
      record.prospectTimezone, record.timezoneSource, record.timezoneConfidence,
      record.followUpCount, record.lastContactedAt, record.nextFollowUpAt, record.repliedAt,
      timestamp, timestamp
    ]
  });
  
  const inserted = await database().execute({ sql: "SELECT * FROM outreach_records WHERE lead_id = ?", args: [record.leadId] });
  return rowToOutreachRecord(inserted.rows[0] as Record<string, unknown>);
}


export async function findOutreachByLeadId(leadId: string): Promise<OutreachRecord | null> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM outreach_records WHERE lead_id = ?", args: [leadId] });
  return result.rows[0] ? rowToOutreachRecord(result.rows[0] as Record<string, unknown>) : null;
}

export async function listOutreachRecords(): Promise<OutreachRecord[]> {
  await ensureSchema();
  const result = await database().execute({ sql: "SELECT * FROM outreach_records ORDER BY created_at DESC", args: [] });
  return result.rows.map((r) => rowToOutreachRecord(r as Record<string, unknown>));
}
