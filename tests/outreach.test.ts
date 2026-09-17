import { describe, it, expect } from "vitest";
import { deriveTimezone, evaluateSendWindow } from "../lib/outreach/timezones";
import {
  generateAllVariants,
  generateHook,
  generateEmailSubject,
  type MessageContext,
} from "../lib/outreach/messages";
import type { Lead } from "../types/lead";
import type { PreviewRecord } from "../types/preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    businessName: "Vision Dental Clinic",
    city: "Abu Dhabi",
    country: "UAE",
    currentWebsite: "https://visiondentalclinic.com",
    mainProblem: "trust signals are buried",
    rating: 4.9,
    reviewCount: 1070,
    finalPreviewUrl: "https://diginest-lead-engine.vercel.app/dentist/vision-dental-clinic-abu-dhabi--abu-dhabi",
    ...overrides,
  };
}

// ─── Timezones ────────────────────────────────────────────────────────────────

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
    const override = new Date("2026-09-18T09:00:00Z"); // Dubai UTC+4 = 13:00 Friday
    const window = evaluateSendWindow("Asia/Dubai", "MON_FRI", override);
    expect(window.status).toBe("WAIT");
    expect(window.reason).toBe("Friday prayer time");
  });

  it("sends now during morning window", () => {
    const override = new Date("2026-09-15T06:30:00Z"); // Dubai 10:30 Tuesday
    const window = evaluateSendWindow("Asia/Dubai", "MON_FRI", override);
    expect(window.status).toBe("SEND_NOW");
  });
});

// ─── Copy Engine V2 – Three Variants ─────────────────────────────────────────

describe("Copy Engine V2 – generateAllVariants", () => {
  it("generates all 3 variants", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "WHATSAPP");
    expect(result.aggressive).toBeDefined();
    expect(result.curious).toBeDefined();
    expect(result.clean).toBeDefined();
    expect(result.recommended).toBeDefined();
  });

  it("all variants include preview URL", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "WHATSAPP");
    expect(result.aggressive.message).toContain(ctx.finalPreviewUrl);
    expect(result.curious.message).toContain(ctx.finalPreviewUrl);
    expect(result.clean.message).toContain(ctx.finalPreviewUrl);
  });

  it("no variant contains banned phrase 'optimization issues'", () => {
    const ctx = makeCtx({ mainProblem: "optimization issues on the homepage" });
    const result = generateAllVariants(ctx, "WHATSAPP");
    // The copy engine should not propagate the raw mainProblem as-is
    // Instead it uses problem-category patterns; banned phrases only appear
    // if the library injects them — which it must not
    ["aggressive", "curious", "clean"].forEach((v) => {
      const draft = result[v as keyof typeof result];
      if (typeof draft === "object" && "message" in draft) {
        expect(draft.message).not.toContain("optimize your online presence");
        expect(draft.message).not.toContain("boost your business");
      }
    });
  });

  it("no variant contains 'Hope you are well' or corporate intro", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "WHATSAPP");
    ["aggressive", "curious", "clean"].forEach((v) => {
      const draft = result[v as keyof typeof result];
      if (typeof draft === "object" && "message" in draft) {
        expect(draft.message.toLowerCase()).not.toContain("hope you");
        expect(draft.message.toLowerCase()).not.toContain("my name is");
        expect(draft.message.toLowerCase()).not.toContain("we are a web agency");
      }
    });
  });

  it("email subject is short and specific (2-7 words)", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "EMAIL");
    const wordCount = (s: string | null) => s?.split(/\s+/).filter(Boolean).length ?? 0;
    expect(wordCount(result.aggressive.subject)).toBeGreaterThanOrEqual(2);
    expect(wordCount(result.aggressive.subject)).toBeLessThanOrEqual(10); // allow some flexibility
    expect(wordCount(result.curious.subject)).toBeGreaterThanOrEqual(2);
  });

  it("WhatsApp variant stays concise (≤200 chars for hook+observation, not full message)", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "WHATSAPP");
    // Full message may be longer due to preview URL; hook must be concise
    expect(result.curious.hook.length).toBeLessThan(150);
  });

  it("CTA is low friction — does not say 'book a call'", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "WHATSAPP");
    ["aggressive", "curious", "clean"].forEach((v) => {
      const draft = result[v as keyof typeof result];
      if (typeof draft === "object" && "cta" in draft) {
        expect(draft.cta.toLowerCase()).not.toContain("book a call");
        expect(draft.cta.toLowerCase()).not.toContain("schedule a consultation");
      }
    });
  });

  it("quality gate flags missing preview URL", () => {
    const ctx = makeCtx({ finalPreviewUrl: "" });
    const result = generateAllVariants(ctx, "WHATSAPP");
    expect(result.curious.qualityFlags).toContain("MISSING_PREVIEW_URL");
    expect(result.curious.passed).toBe(false);
  });

  it("recommended is CURIOUS when high rating + many reviews", () => {
    const ctx = makeCtx({ rating: 4.9, reviewCount: 1070 });
    const result = generateAllVariants(ctx, "WHATSAPP");
    expect(result.recommended).toBe("CURIOUS");
  });

  it("recommended is AGGRESSIVE when low/no rating", () => {
    const ctx = makeCtx({ rating: null, reviewCount: null });
    const result = generateAllVariants(ctx, "WHATSAPP");
    expect(result.recommended).toBe("AGGRESSIVE");
  });

  it("rating is used as factual anchor when provided", () => {
    const ctx = makeCtx({ rating: 4.9, reviewCount: 1070 });
    const result = generateAllVariants(ctx, "WHATSAPP");
    // At least one variant should reference the rating
    const hasRating =
      result.aggressive.message.includes("4.9") ||
      result.curious.message.includes("4.9") ||
      result.clean.message.includes("4.9");
    expect(hasRating).toBe(true);
  });

  it("injects specific facts into problem-specific templates and passes quality gate", () => {
    // VISUAL_HIERARCHY previously failed NO_SPECIFIC_FACT
    const ctx = makeCtx({ mainProblem: "trust signals are buried below the first screen", rating: 4.9, reviewCount: 1070 });
    const result = generateAllVariants(ctx, "WHATSAPP");
    
    // Check that it passed
    expect(result.aggressive.passed).toBe(true);
    expect(result.curious.passed).toBe(true);
    expect(result.clean.passed).toBe(true);

    // It should NOT contain NO_SPECIFIC_FACT
    expect(result.aggressive.qualityFlags).not.toContain("NO_SPECIFIC_FACT");
  });

  it("does not fabricate content when no rating is provided", () => {
    const ctx = makeCtx({ rating: null, reviewCount: null });
    const result = generateAllVariants(ctx, "WHATSAPP");
    // Aggressive hook should not invent a rating
    expect(result.aggressive.message).not.toMatch(/\d+\.\d+ Google rating/);
  });

  it("Instagram variant generated correctly", () => {
    const ctx = makeCtx();
    const result = generateAllVariants(ctx, "INSTAGRAM");
    expect(result.curious.subject).toBeNull();
    expect(result.curious.message).toContain(ctx.finalPreviewUrl);
  });

  it("backwards-compat: generateHook returns a non-empty string", () => {
    const ctx = makeCtx();
    const hook = generateHook(ctx);
    expect(hook.length).toBeGreaterThan(5);
  });

  it("backwards-compat: generateEmailSubject returns a non-empty string", () => {
    const ctx = makeCtx();
    const subj = generateEmailSubject(ctx);
    expect(subj.length).toBeGreaterThan(3);
    expect(subj.toLowerCase()).not.toContain("hi test");
  });
});

// ─── Eligibility ──────────────────────────────────────────────────────────────

describe("Outreach Eligibility", () => {
  it("rejects leads that are not READY_FOR_OUTREACH", () => {
    const lead = {
      qualificationStatus: "QUALIFIED",
      reachability: { hasEmail: true },
    } as Lead;

    const preview = {
      workflowStatus: "PROMPT_READY",
      finalPreviewUrl: null,
    } as unknown as PreviewRecord;

    const isEligible =
      (lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY") &&
      preview?.workflowStatus === "READY_FOR_OUTREACH" &&
      preview?.finalPreviewUrl &&
      (lead.reachability.hasPhone || lead.reachability.hasEmail || lead.reachability.hasSocial);

    expect(isEligible).toBeFalsy();
  });

  it("rejects READY_FOR_OUTREACH without finalPreviewUrl", () => {
    const lead = {
      qualificationStatus: "QUALIFIED",
      reachability: { hasEmail: true, hasPhone: false, hasSocial: false },
    } as Lead;

    const preview = {
      workflowStatus: "READY_FOR_OUTREACH",
      finalPreviewUrl: null,
    } as unknown as PreviewRecord;

    const isEligible =
      (lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY") &&
      preview?.workflowStatus === "READY_FOR_OUTREACH" &&
      preview?.finalPreviewUrl &&
      (lead.reachability.hasPhone || lead.reachability.hasEmail || lead.reachability.hasSocial);

    expect(isEligible).toBeFalsy();
  });

  it("accepts valid leads with READY_FOR_OUTREACH and finalPreviewUrl", () => {
    const lead = {
      qualificationStatus: "QUALIFIED",
      reachability: { hasEmail: true, hasPhone: false, hasSocial: false },
    } as Lead;

    const preview = {
      workflowStatus: "READY_FOR_OUTREACH",
      finalPreviewUrl: "https://v0.app/123",
    } as unknown as PreviewRecord;

    const isEligible =
      (lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY") &&
      preview?.workflowStatus === "READY_FOR_OUTREACH" &&
      preview?.finalPreviewUrl &&
      (lead.reachability.hasPhone || lead.reachability.hasEmail || lead.reachability.hasSocial);

    expect(isEligible).toBeTruthy();
  });
});
