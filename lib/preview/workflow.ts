import type { V0WorkflowStatus } from "@/types/preview";

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
}import type { PreviewRecord } from "@/types/preview";

export function validateMarkReadyForOutreach(record: PreviewRecord | null): { ok: boolean; error?: string } {
  if (!record || !record.finalPreviewUrl) {
    return { ok: false, error: "Cannot mark ready for outreach without a final preview URL" };
  }
  return { ok: true };
}
