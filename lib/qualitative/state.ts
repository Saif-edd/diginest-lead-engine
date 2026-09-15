import type { QualitativeAuditStatus, WebsiteAudit } from "../../types/audit";
import { objectiveStatusFor } from "../audit/state";

const allowedTransitions: Record<QualitativeAuditStatus, QualitativeAuditStatus[]> = {
  NOT_READY: ["PENDING"],
  PENDING: ["ANALYZING"],
  ANALYZING: ["COMPLETE", "FAILED"],
  COMPLETE: ["PENDING"],
  FAILED: ["PENDING"],
};

export function qualitativeStatusFor(audit: Pick<WebsiteAudit, "qualitativeAuditStatus" | "objectiveAuditStatus" | "status">): QualitativeAuditStatus {
  if (audit.qualitativeAuditStatus) return audit.qualitativeAuditStatus;
  return objectiveStatusFor(audit) === "COMPLETE" ? "PENDING" : "NOT_READY";
}

export function canTransitionQualitative(
  from: QualitativeAuditStatus,
  to: QualitativeAuditStatus,
) {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionQualitativeStatus(
  audit: WebsiteAudit,
  nextStatus: QualitativeAuditStatus,
): WebsiteAudit {
  if (objectiveStatusFor(audit) !== "COMPLETE" && nextStatus !== "NOT_READY") {
    throw new Error("Qualitative analysis requires a completed objective audit");
  }
  const from = qualitativeStatusFor(audit);
  if (!canTransitionQualitative(from, nextStatus)) {
    throw new Error(`Invalid qualitative transition: ${from} -> ${nextStatus}`);
  }
  return {
    ...audit,
    qualitativeAuditStatus: nextStatus,
  };
}
