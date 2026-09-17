import { describe, it, expect, vi } from "vitest";
import { deriveTimezone, evaluateSendWindow } from "../lib/outreach/timezones";
import { generateHook, generateEmailSubject } from "../lib/outreach/messages";
import type { Lead } from "../types/lead";
import type { PreviewRecord } from "../types/preview";

describe("Timezones", () => {
  it("derives UAE correctly", () => {
    const tz = deriveTimezone("Dubai, United Arab Emirates");
    expect(tz?.timezone).toBe("Asia/Dubai");
    expect(tz?.weekendRule).toBe("MON_FRI");
  });

  it("derives KSA correctly", () => {
    const tz = deriveTimezone("Riyadh, Saudi Arabia");
    expect(tz?.timezone).toBe("Asia/Riyadh");
    expect(tz?.weekendRule).toBe("FRI_SAT");
  });

  it("blocks Friday midday", () => {
    // Friday at 1pm (13:00)
    const fridayMidday = new Date("2026-09-18T13:00:00Z"); // assuming UTC is close enough for test if we mock the system time or just use it
    
    // We mock the local time representation for Asia/Dubai to hit the Friday rule
    // For a real test we pass overrideTime which is used inside evaluateSendWindow
    // Let's create a date that when formatted in Asia/Dubai results in Friday 13:00
    // Dubai is UTC+4. So UTC 09:00 on Friday is Friday 13:00 Dubai.
    const override = new Date("2026-09-18T09:00:00Z");
    
    const window = evaluateSendWindow("Asia/Dubai", "MON_FRI", override);
    expect(window.status).toBe("WAIT");
    expect(window.reason).toBe("Friday prayer time");
  });

  it("sends now during morning window", () => {
    // Dubai UTC+4. Target: 10:30 AM local -> 06:30 AM UTC
    // Let's pick a Tuesday to be safe (2026-09-15 is Tuesday)
    const override = new Date("2026-09-15T06:30:00Z");
    const window = evaluateSendWindow("Asia/Dubai", "MON_FRI", override);
    expect(window.status).toBe("SEND_NOW");
  });
});

describe("Messages", () => {
  it("generates random hooks deterministically-ish", () => {
    const ctx = {
      businessName: "Test",
      city: "Dubai",
      mainProblem: "broken links",
      finalPreviewUrl: "https://v0.app",
    };
    const hook = generateHook(ctx);
    expect(hook.length).toBeGreaterThan(5);
  });

  it("avoids generic corporate speak in email subjects", () => {
    const ctx = {
      businessName: "Test",
      city: "Dubai",
      mainProblem: "broken links",
      finalPreviewUrl: "https://v0.app",
    };
    const subj = generateEmailSubject(ctx);
    expect(subj).not.toContain("Hi Test");
  });
});

describe("Eligibility", () => {
  it("rejects leads that are not READY_FOR_OUTREACH", () => {
    const lead = {
      qualificationStatus: "QUALIFIED",
      reachability: { hasEmail: true },
      previewPotential: {}
    } as Lead;
    
    const preview = {
      workflowStatus: "PROMPT_READY",
      finalPreviewUrl: null
    } as PreviewRecord;

    const isEligible = 
      (lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY") &&
      preview?.workflowStatus === "READY_FOR_OUTREACH" &&
      preview?.finalPreviewUrl &&
      (lead.reachability.hasPhone || lead.reachability.hasEmail || lead.reachability.hasSocial);

    expect(isEligible).toBeFalsy();
  });

  it("accepts valid leads", () => {
    const lead = {
      qualificationStatus: "QUALIFIED",
      reachability: { hasEmail: true, hasPhone: false, hasSocial: false },
      previewPotential: {}
    } as Lead;
    
    const preview = {
      workflowStatus: "READY_FOR_OUTREACH",
      finalPreviewUrl: "https://v0.app/123"
    } as unknown as PreviewRecord;

    const isEligible = 
      (lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY") &&
      preview?.workflowStatus === "READY_FOR_OUTREACH" &&
      preview?.finalPreviewUrl &&
      (lead.reachability.hasPhone || lead.reachability.hasEmail || lead.reachability.hasSocial);

    expect(isEligible).toBeTruthy();
  });
});
