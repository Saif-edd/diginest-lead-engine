import { describe, expect, it } from "vitest";
import { emptyWebsiteAudit } from "../lib/audit/record";
import { applyQualitativeResultToLead } from "../lib/qualitative/apply";
import { analyzeQualitative } from "../lib/qualitative/analyzer";
import { qualitativeIdempotencyKey } from "../lib/qualitative/idempotency";
import { qualitativeStatusFor, transitionQualitativeStatus } from "../lib/qualitative/state";
import { QualitativeValidationError, normalizeQualitativeResult } from "../lib/qualitative/schema";
import { OpenAICompatibleQualitativeProvider } from "../lib/qualitative/provider";
import { normalizeRows } from "../lib/normalization";

function rawResult(overrides: Record<string, unknown> = {}) {
  const dimensions = {
    mobileResponsive: { score: 1, maxScore: 6, severity: "MINOR", reason: "The supplied evidence supports only a small responsive concern.", evidenceUsed: [{ source: "audit", field: "mobileViewport", detail: "Viewport is present." }], confidence: "MEDIUM" },
    heroMessageClarity: { score: 3, maxScore: 5, severity: "MAJOR", reason: "The homepage hierarchy leaves the primary value proposition unclear.", evidenceUsed: [{ source: "audit", field: "h1", detail: "The supplied H1 is generic." }], confidence: "MEDIUM" },
    ctaContactBooking: { score: 6, maxScore: 8, severity: "CRITICAL", reason: "The visible conversion path is difficult to identify.", evidenceUsed: [{ source: "signal", field: "booking", detail: "No verified booking signal was supplied." }], confidence: "MEDIUM" },
    visualTrustDesign: { score: 1, maxScore: 6, severity: "MINOR", reason: "The screenshot supports limited visual polish concerns.", evidenceUsed: [{ source: "screenshot", field: "homepage", detail: "Homepage screenshot reviewed." }], confidence: "MEDIUM" },
    servicesNavigation: { score: 1, maxScore: 4, severity: "MINOR", reason: "Named service evidence is present but navigation can be clearer.", evidenceUsed: [{ source: "signal", field: "services", detail: "Named service evidence is present." }], confidence: "MEDIUM" },
    speedPerformance: { score: 0, maxScore: 4, severity: "NONE", reason: "No reliable performance problem is supported by the supplied evidence.", evidenceUsed: [{ source: "audit", field: "performance", detail: "Measured navigation timing is available." }], confidence: "LOW" },
    reviewsTeamTrust: { score: 1, maxScore: 3, severity: "MINOR", reason: "Trust evidence exists but its presentation is limited.", evidenceUsed: [{ source: "signal", field: "reviews", detail: "Review signal was supplied." }], confidence: "MEDIUM" },
    localSeoTechnical: { score: 1, maxScore: 4, severity: "MINOR", reason: "The technical evidence supports a small local SEO improvement.", evidenceUsed: [{ source: "audit", field: "schemaTypes", detail: "Schema fields are supplied." }], confidence: "MEDIUM" },
  };
  return {
    schemaVersion: "sprint-2b.v1",
    dimensions,
    mainProblem: "The visible conversion path is difficult to identify.",
    mainProblemSeverity: "CRITICAL",
    secondaryProblems: [],
    qualificationDecision: "QUALIFY",
    qualificationReason: "The opportunity gate passes on one critical problem.",
    commercialProfile: { score: 4, maxScore: 5, evidenceUsed: [{ source: "lead", field: "category", detail: "Dentist" }], confidence: "HIGH" },
    previewPotential: { realInformationAssets: 4, clearServiceAngle: 4, transformationOpportunity: 4, personalizedCtaPotential: 4, evidenceUsed: [{ source: "lead", field: "category", detail: "Dentist" }], confidence: "MEDIUM" },
    outreachAngle: "Make the first consultation path easier to find.",
    recommendedPreviewDepth: "STRONG",
    recommendedPreviewFocus: "A clearer consultation-first homepage.",
    recommendedCTA: "Book a consultation",
    recommendedHeroAngle: "Confident dental care with a clear next step",
    recommendedSections: ["Services", "Trust proof", "Booking CTA"],
    ...overrides,
  };
}

describe("qualitative state machine", () => {
  it("moves only completed objective audits into qualitative analysis", () => {
    const audit = emptyWebsiteAudit("COMPLETE");
    expect(qualitativeStatusFor(audit)).toBe("PENDING");
    expect(transitionQualitativeStatus(audit, "ANALYZING").qualitativeAuditStatus).toBe("ANALYZING");
    const retryPending = transitionQualitativeStatus({ ...audit, qualitativeAuditStatus: "FAILED" }, "PENDING");
    expect(retryPending.qualitativeAuditStatus).toBe("PENDING");
    expect(transitionQualitativeStatus(retryPending, "ANALYZING").qualitativeAuditStatus).toBe("ANALYZING");
    expect(() => transitionQualitativeStatus(emptyWebsiteAudit("PENDING"), "ANALYZING")).toThrow(/completed objective/);
  });
});

describe("qualitative schema and scoring", () => {
  it("recomputes the opportunity gate and prevents an unsafe QUALIFY", () => {
    const result = normalizeQualitativeResult(rawResult({
      dimensions: Object.fromEntries(Object.entries(rawResult().dimensions).map(([key, value]) => [key, { ...(value as object), severity: "NONE", score: 0 }])),
      qualificationDecision: "QUALIFY",
    }), "test-model", "2026-09-15T00:00:00.000Z");
    expect(result.websiteOpportunityScore).toBe(0);
    expect(result.opportunityGate.passes).toBe(false);
    expect(result.qualificationDecision).toBe("HOLD");
  });

  it("rejects invalid AI output", () => {
    expect(() => normalizeQualitativeResult({}, "test-model", new Date().toISOString())).toThrow(QualitativeValidationError);
  });

  it("finalizes score and qualification only after a complete qualitative result", () => {
    const lead = normalizeRows([{ name: "Clinic", address: "Dubai", website: "https://clinic.example", category: "Dentist", rating: "4.8", total_ratings: "500" }]).leads[0];
    const result = normalizeQualitativeResult(rawResult(), "test-model", "2026-09-15T00:00:00.000Z");
    const analyzed = applyQualitativeResultToLead({ ...lead, audit: { ...lead.audit, status: "COMPLETE", objectiveAuditStatus: "COMPLETE", qualitativeAuditStatus: "ANALYZING" } }, result, 1);
    expect(analyzed.audit.qualitativeAuditStatus).toBe("COMPLETE");
    expect(analyzed.score.isFinal).toBe(true);
    expect(analyzed.qualificationStatus).toBe("QUALIFIED");
  });

  it("keeps manual HOLD and SKIP ahead of AI output", () => {
    const lead = normalizeRows([{ name: "Clinic", address: "Dubai", website: "https://clinic.example", category: "Dentist" }]).leads[0];
    const result = normalizeQualitativeResult(rawResult(), "test-model", "2026-09-15T00:00:00.000Z");
    expect(applyQualitativeResultToLead({ ...lead, manualDecision: "HOLD" }, result, 1).qualificationStatus).toBe("HOLD");
    expect(applyQualitativeResultToLead({ ...lead, manualDecision: "SKIP" }, result, 1).qualificationStatus).toBe("SKIP");
  });
});

describe("qualitative provider failure and idempotency", () => {
  it("uses a production Groq model by default when no model is configured", () => {
    expect(new OpenAICompatibleQualitativeProvider("test-key", undefined, "https://api.groq.com/openai/v1").modelVersion).toBe("openai/gpt-oss-20b");
    expect(new OpenAICompatibleQualitativeProvider("test-key", undefined, "https://api.openai.com/v1").modelVersion).toBe("gpt-4o-mini");
  });

  it("omits screenshots for Groq text-only models and marks visual evidence unavailable", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await new OpenAICompatibleQualitativeProvider("test-key", "openai/gpt-oss-20b", "https://api.groq.com/openai/v1").analyze({
        context: {
          business: { name: "Synthetic clinic", category: "Dentist", address: "Synthetic address" },
          objectiveAudit: {
            objectiveAuditStatus: "COMPLETE",
            h1: [],
            schemaTypes: [],
            deterministicSignals: {},
            signalEvidence: {},
            screenshotAvailable: true,
          },
        },
        screenshotDataUrl: "data:image/png;base64,c3ludGhldGlj",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const messages = requestBody?.messages as Array<{ content: unknown }>;
    expect(requestBody?.reasoning_effort).toBe("low");
    expect(messages[1].content).toHaveLength(1);
    const text = String((messages[1].content as Array<{ text: string }>)[0].text);
    expect(text).toContain('"screenshotAvailable": false');
    expect(text).toContain("The configured provider model does not support image input.");
    expect(text).not.toContain("c3ludGhldGlj");
  });

  it("omits screenshots for TokenWave Luna because vision is disabled", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await new OpenAICompatibleQualitativeProvider("test-key", "gpt-5.6-luna", "https://tokenwave.ru/v1").analyze({
        context: {
          business: { name: "Synthetic clinic", category: "Dentist", address: "Synthetic address" },
          objectiveAudit: {
            objectiveAuditStatus: "COMPLETE",
            h1: [],
            schemaTypes: [],
            deterministicSignals: {},
            signalEvidence: {},
            screenshotAvailable: true,
          },
        },
        screenshotDataUrl: "data:image/png;base64,c3ludGhldGlj",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const messages = requestBody?.messages as Array<{ content: unknown }>;
    expect(messages[1].content).toHaveLength(1);
    const text = String((messages[1].content as Array<{ text: string }>)[0].text);
    expect(text).toContain('"screenshotAvailable": false');
    expect(text).toContain("The configured provider model does not support image input.");
    expect(text).not.toContain("c3ludGhldGlj");
  });

  it("surfaces invalid provider output without making a result", async () => {
    const lead = normalizeRows([{ name: "Clinic", address: "Dubai", website: "https://clinic.example", category: "Dentist" }]).leads[0];
    await expect(analyzeQualitative({ context: { business: { name: lead.name, category: lead.category, address: lead.address }, objectiveAudit: { objectiveAuditStatus: "COMPLETE", h1: [], schemaTypes: [], deterministicSignals: {}, signalEvidence: {}, screenshotAvailable: false } } }, { modelVersion: "test-model", analyze: async () => ({}) })).rejects.toThrow(QualitativeValidationError);
  });

  it("uses stable keys for retries and distinct keys for new attempts", () => {
    const lead = normalizeRows([{ name: "Clinic", address: "Dubai", website: "https://clinic.example", category: "Dentist" }]).leads[0];
    const first = qualitativeIdempotencyKey({ ...lead, audit: { ...lead.audit, auditTimestamp: "2026-09-15T00:00:00.000Z" } }, 1);
    expect(qualitativeIdempotencyKey({ ...lead, audit: { ...lead.audit, auditTimestamp: "2026-09-15T00:00:00.000Z" } }, 1)).toBe(first);
    expect(qualitativeIdempotencyKey(lead, 2)).not.toBe(first);
  });
});
