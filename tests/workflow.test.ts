import { describe, it, expect } from "vitest";
import { deriveWorkflowStatus, validateMarkReadyForOutreach } from "../lib/preview/workflow";

describe("Workflow Status Derivation", () => {
  it("legacy READY + no URL does not become URL_ADDED", () => {
    // If the legacy backend finished generation but didn't deploy (finalUrl null),
    // and there is no V0 prompt pack (hasPrompt false), it should be BRIEF_READY or PROMPT_READY.
    // Above all, it must NOT be PREVIEW_LINK_ADDED (URL_ADDED).
    const ws1 = deriveWorkflowStatus(null, "READY", null, false);
    expect(ws1).toBe("BRIEF_READY");

    const ws2 = deriveWorkflowStatus("NOT_STARTED", "READY", null, true);
    expect(ws2).toBe("PROMPT_READY");

    // Ensure it's not PREVIEW_LINK_ADDED
    expect(ws1).not.toBe("PREVIEW_LINK_ADDED");
    expect(ws2).not.toBe("PREVIEW_LINK_ADDED");
  });

  it("legacy READY + has finalUrl maps to READY_FOR_OUTREACH", () => {
    const ws = deriveWorkflowStatus(null, "READY", "https://deployed.vercel.app", false);
    expect(ws).toBe("READY_FOR_OUTREACH");
  });
});
  it("READY_FOR_OUTREACH requires finalPreviewUrl", () => {
    const res1 = validateMarkReadyForOutreach(null);
    expect(res1.ok).toBe(false);

    const res2 = validateMarkReadyForOutreach({ finalPreviewUrl: null } as unknown as import("../types/preview").PreviewRecord);
    expect(res2.ok).toBe(false);

    const res3 = validateMarkReadyForOutreach({ finalPreviewUrl: "" } as unknown as import("../types/preview").PreviewRecord);
    expect(res3.ok).toBe(false);

    const res4 = validateMarkReadyForOutreach({ finalPreviewUrl: "https://foo.vercel.app" } as unknown as import("../types/preview").PreviewRecord);
    expect(res4.ok).toBe(true);
  });

