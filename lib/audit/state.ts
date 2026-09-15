import type { AuditStatus, WebsiteAudit } from "../../types/audit";

const allowedTransitions: Record<AuditStatus, AuditStatus[]> = {
  PENDING: ["QUEUED"],
  QUEUED: ["AUDITING"],
  AUDITING: ["COMPLETE", "FAILED", "BLOCKED"],
  COMPLETE: ["QUEUED"],
  FAILED: ["QUEUED"],
  BLOCKED: ["QUEUED"],
  "NOT REQUIRED": [],
};

export function canTransitionAudit(
  from: AuditStatus,
  to: AuditStatus,
): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionAuditStatus(
  audit: WebsiteAudit,
  nextStatus: AuditStatus,
): WebsiteAudit {
  if (!canTransitionAudit(audit.status, nextStatus)) {
    throw new Error(
      `Invalid audit transition: ${audit.status} → ${nextStatus}`,
    );
  }
  return { ...audit, status: nextStatus };
}

export function queueAudit(audit: WebsiteAudit): WebsiteAudit {
  return transitionAuditStatus(audit, "QUEUED");
}
