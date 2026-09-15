import type { Lead } from "../../types/lead";

export function qualitativeIdempotencyKey(lead: Pick<Lead, "leadId" | "website" | "audit">, retryCount: number) {
  const auditVersion = lead.audit.auditTimestamp ?? lead.audit.finalUrl ?? lead.website ?? "unknown-audit";
  return `${lead.leadId}:qualitative:${auditVersion}:${retryCount}`;
}
