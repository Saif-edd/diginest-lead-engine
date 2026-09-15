import type {
  AuditStatus,
  ObjectiveAuditStatus,
  WebsiteAudit,
} from "../../types/audit";

const allowedTransitions: Record<AuditStatus, AuditStatus[]> = {
  PENDING: ["QUEUED"],
  QUEUED: ["AUDITING"],
  AUDITING: ["COMPLETE", "FAILED", "BLOCKED"],
  COMPLETE: ["QUEUED"],
  FAILED: ["QUEUED"],
  BLOCKED: ["QUEUED"],
  "NOT REQUIRED": [],
};

export function objectiveStatusFor(
  audit: Pick<WebsiteAudit, "objectiveAuditStatus" | "status">,
): ObjectiveAuditStatus {
  return (
    audit.objectiveAuditStatus ??
    (audit.status === "NOT REQUIRED" ? "PENDING" : audit.status)
  );
}

export function canTransitionAudit(from: AuditStatus, to: AuditStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionAuditStatus(
  audit: WebsiteAudit,
  nextStatus: AuditStatus,
): WebsiteAudit {
  const from = objectiveStatusFor(audit);
  if (!canTransitionAudit(from, nextStatus)) {
    throw new Error(`Invalid audit transition: ${from} → ${nextStatus}`);
  }
  return {
    ...audit,
    status: nextStatus,
    objectiveAuditStatus:
      nextStatus === "NOT REQUIRED" ? "PENDING" : nextStatus,
    qualitativeAuditStatus:
      nextStatus === "COMPLETE"
        ? audit.qualitativeAuditStatus === "COMPLETE"
          ? "COMPLETE"
          : "PENDING"
        : "NOT_READY",
  };
}

export function queueAudit(audit: WebsiteAudit) {
  return transitionAuditStatus(audit, "QUEUED");
}

export function recoverStaleAudit(
  audit: WebsiteAudit,
  now = Date.now(),
  staleAfterMs = 10 * 60 * 1000,
) {
  if (objectiveStatusFor(audit) !== "AUDITING") return audit;
  const heartbeat = Date.parse(audit.heartbeatAt ?? audit.startedAt ?? "");
  if (!Number.isFinite(heartbeat) || now - heartbeat < staleAfterMs) return audit;
  const timestamp = new Date(now).toISOString();
  return {
    ...audit,
    status: "FAILED" as const,
    objectiveAuditStatus: "FAILED" as const,
    qualitativeAuditStatus: "NOT_READY" as const,
    failureReason: "STALE" as const,
    failureMessage: "Audit worker became stale and is ready to retry.",
    completedAt: timestamp,
    heartbeatAt: timestamp,
  };
}
