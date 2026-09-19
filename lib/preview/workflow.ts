import type { PreviewRecord, V0WorkflowStatus } from "@/types/preview";

/**
 * A preview can be public either through the legacy workflow or through the
 * explicit V0 approval workflow. Keeping this rule in one place prevents the
 * public route from rejecting correctly approved V0 records.
 */
export function isPreviewPubliclyReady(
  record: Pick<PreviewRecord, "status" | "workflowStatus">,
) {
  return record.status === "READY" ||
    record.status === "READY_FOR_OUTREACH" ||
    record.workflowStatus === "READY_FOR_OUTREACH";
}

export function deriveWorkflowStatus(
  workflowStatus: string | null | undefined,
  legacyStatus: string | null | undefined,
  finalPreviewUrl: string | null | undefined,
  hasPrompt: boolean
): V0WorkflowStatus {
  let ws = workflowStatus || "";
  if (!ws || ws === "undefined" || ws === "null" || ws === "NOT_STARTED") {
    if (legacyStatus === "READY") {
      ws = finalPreviewUrl ? "READY_FOR_OUTREACH" : (hasPrompt ? "PROMPT_READY" : "BRIEF_READY");
    } else if (legacyStatus === "DRAFT") {
      ws = hasPrompt ? "PROMPT_READY" : "BRIEF_READY";
    } else {
      ws = "NOT_STARTED";
    }
  }
  return ws as V0WorkflowStatus;
}

export function validateMarkReadyForOutreach(record: PreviewRecord | null): { ok: boolean; error?: string } {
  if (!record || !record.finalPreviewUrl) {
    return { ok: false, error: "Cannot mark ready for outreach without a final preview URL" };
  }
  return { ok: true };
}
