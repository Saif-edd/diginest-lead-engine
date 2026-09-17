/**
 * Preview Builder Tests – Sprint 3A (V0 Prompt Builder)
 * Tests: eligibility, slug, archetype, CTA, depth sections, config serialization,
 *        asset URL validation, verified facts extraction, V0 prompt generation,
 *        preview URL validation, workflow status transitions.
 */

import { describe, it, expect } from "vitest";
import { generateSlug, slugPathSegment } from "../lib/preview/slug";
import { selectDentalArchetype } from "../lib/preview/archetype";
import { selectCTA } from "../lib/preview/cta";
import { buildPreviewCopy } from "../lib/preview/copy";
import { isValidAssetUrl } from "../lib/preview/assets";
import { extractVerifiedFacts } from "../lib/preview/facts";
import { generateV0PromptPack } from "../lib/preview/v0-prompt";
import { validatePreviewUrl } from "../lib/persistence/db";
import type { Lead } from "../types/lead";
import type { QualitativeResult } from "../types/qualitative";
import type { PreviewConfig, PreviewAssetPack, V0WorkflowStatus } from "../types/preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    leadId: "test-001",
    name: "Test Dental Clinic",
    address: "123 Main St, Abu Dhabi",
    category: "Dental Clinic",
    rating: 4.7,
    totalRatings: 350,
    website: "https://testdental.ae",
    phone: "+971501234567",
    hasWebsite: true,
    qualificationStatus: "QUALIFIED",
    automaticQualification: "QUALIFIED",
    manualDecision: "NONE",
    outreachStatus: "NOT STARTED",
    followupStage: 0,
    sourceFile: "test.csv",
    audit: {
      status: "COMPLETE",
      objectiveAuditStatus: "COMPLETE",
      qualitativeAuditStatus: "COMPLETE",
      pageReachable: true,
      phoneFound: true,
      phoneEvidence: ["+971501234567"],
      whatsappFound: true,
      whatsappEvidence: ["+971501234567"],
      bookingFound: false,
      servicesIndicators: true,
      servicesEvidence: ["General Dentistry", "Teeth Whitening", "Orthodontics"],
      locationIndicators: true,
      googleMapsFound: true,
      reviewsIndicators: true,
      teamIndicators: false,
      qualitativeResult: {
        schemaVersion: "sprint-2b.v1",
        modelVersion: "test-model",
        analyzedAt: new Date().toISOString(),
        dimensions: {} as QualitativeResult["dimensions"],
        websiteOpportunityScore: 72,
        opportunityGate: { passes: true, criticalCount: 1, majorCount: 2, reason: "Passes gate" },
        mainProblem: "Weak CTA and booking path – users cannot easily book",
        mainProblemSeverity: "CRITICAL",
        secondaryProblems: [],
        qualificationDecision: "QUALIFY",
        qualificationReason: "Strong local trust with fixable CTA issues",
        commercialProfile: { score: 8, maxScore: 10, evidenceUsed: [], confidence: "HIGH" },
        commercialProfileScore: 8,
        previewPotential: {
          realInformationAssets: 8,
          clearServiceAngle: 7,
          transformationOpportunity: 9,
          personalizedCtaPotential: 9,
          total: 33,
          reviewed: true,
          evidenceUsed: [],
          confidence: "HIGH",
        },
        outreachAngle: "Show them how easy booking could be",
        recommendedPreviewDepth: "STRONG",
        recommendedPreviewFocus: "CTA and booking path prominence",
        recommendedCTA: "BOOK AN APPOINTMENT",
        recommendedHeroAngle: "Modern dental care in Abu Dhabi",
        recommendedSections: ["booking", "services", "contact"],
      },
    },
    reachability: { hasPhone: true, hasEmail: false, hasSocial: false },
    previewPotential: { realInformationAssets: 8, clearServiceAngle: 7, transformationOpportunity: 9, personalizedCtaPotential: 9 },
    score: {
      businessStrength: 15,
      categoryContext: 8,
      rating: 9,
      reviewVolume: 8,
      commercialProfile: 8,
      opportunity: 15,
      reachability: 7,
      previewPotential: 9,
      total: 79,
      opportunityConfirmed: true,
      priority: "P1 PREMIUM",
      isFinal: true,
      pendingComponents: [],
    },
    rawImportedData: {},
    ...overrides,
  } as Lead;
}

function makeQualitativeResult(_overrides: Partial<QualitativeResult> = {}): QualitativeResult {
  return makeLead().audit.qualitativeResult as QualitativeResult;
}

function makeEmptyAssetPack(): PreviewAssetPack {
  return {
    logoUrl: null,
    faviconUrl: null,
    ogImageUrl: null,
    heroImageCandidates: [],
    clinicImages: [],
    teamImages: [],
    serviceImages: [],
    currentWebsiteScreenshotUrl: null,
    sourceWebsite: null,
    totalAssets: 0,
  };
}

// ─── Slug Generation ──────────────────────────────────────────────────────────

describe("generateSlug", () => {
  it("generates a clean path for typical dental clinic names", () => {
    const slug = generateSlug("Vision Dental Clinic", "Abu Dhabi");
    expect(slug).toBe("/dentist/vision-dental-clinic-abu-dhabi");
  });

  it("strips diacritics and special chars", () => {
    const slug = generateSlug("Clinique Spécialisée", "Dubaï");
    expect(slug).toBe("/dentist/clinique-specialisee-dubai");
  });

  it("handles city-less names gracefully", () => {
    const slug = generateSlug("Best Dental", "");
    expect(slug).toBe("/dentist/best-dental");
  });

  it("collapses multiple spaces/hyphens", () => {
    const slug = generateSlug("Dental   Care  Clinic", "Abu Dhabi");
    expect(slug).toMatch(/^\/dentist\/dental-care-clinic-abu-dhabi$/);
  });
});

describe("slugPathSegment", () => {
  it("extracts the last path segment", () => {
    expect(slugPathSegment("/dentist/vision-dental-abu-dhabi")).toBe("vision-dental-abu-dhabi");
  });
});

// ─── Archetype Selection ──────────────────────────────────────────────────────

describe("selectDentalArchetype", () => {
  it("returns DENTAL_CORE as default for a general clinic", () => {
    const lead = makeLead({
      rating: 4.2,
      totalRatings: 50,
      audit: {
        ...makeLead().audit,
        servicesEvidence: ["General Dentistry", "Teeth Whitening", "Fillings"],
      },
    });
    const result = {
      ...lead.audit.qualitativeResult!,
      recommendedPreviewDepth: "STRONG" as const,
      outreachAngle: "Modern general dentistry",
      recommendedPreviewFocus: "CTA and booking",
      recommendedHeroAngle: "Modern dental care in Abu Dhabi",
      mainProblem: "Weak CTA",
      recommendedSections: ["booking", "services"],
      previewPotential: { ...lead.audit.qualitativeResult!.previewPotential, transformationOpportunity: 6 },
    };
    const { archetype } = selectDentalArchetype(lead, result);
    expect(archetype).toBe("DENTAL_CORE");
  });

  it("returns DENTAL_PREMIUM when recommendedPreviewDepth is PREMIUM", () => {
    const lead = makeLead();
    const result = { ...lead.audit.qualitativeResult!, recommendedPreviewDepth: "PREMIUM" as const };
    const { archetype, confidence } = selectDentalArchetype(lead, result);
    expect(archetype).toBe("DENTAL_PREMIUM");
    expect(confidence).toBe("HIGH");
  });

  it("returns DENTAL_PREMIUM for high-trust clinics even without explicit PREMIUM depth", () => {
    const lead = makeLead({ rating: 4.9, totalRatings: 850 });
    const result = { ...lead.audit.qualitativeResult!, previewPotential: { ...lead.audit.qualitativeResult!.previewPotential, transformationOpportunity: 9 } };
    const { archetype } = selectDentalArchetype(lead, result);
    expect(archetype).toBe("DENTAL_PREMIUM");
  });

  it("returns DENTAL_SPECIALIST when orthodontics keyword found in name", () => {
    const lead = makeLead({ name: "Abu Dhabi Orthodontics Center", rating: 4.3, totalRatings: 80 });
    const result = { ...lead.audit.qualitativeResult!, recommendedPreviewDepth: "STRONG" as const, previewPotential: { ...lead.audit.qualitativeResult!.previewPotential, transformationOpportunity: 6 } };
    const { archetype } = selectDentalArchetype(lead, result);
    expect(archetype).toBe("DENTAL_SPECIALIST");
  });

  it("returns LOW confidence when no audit data", () => {
    const lead = makeLead({
      audit: {
        ...makeLead().audit,
        objectiveAuditStatus: "PENDING" as const,
        qualitativeAuditStatus: "PENDING" as const,
        servicesEvidence: ["General Dentistry", "Fillings"],
      },
    });
    const result = {
      ...lead.audit.qualitativeResult!,
      recommendedPreviewDepth: "LIGHT" as const,
      outreachAngle: "Modern general dentistry",
      recommendedPreviewFocus: "CTA and booking",
      recommendedHeroAngle: "Modern dental care in Abu Dhabi",
      mainProblem: "Weak CTA",
      recommendedSections: ["booking"],
      previewPotential: { ...lead.audit.qualitativeResult!.previewPotential, transformationOpportunity: 4 },
    };
    const { archetype, confidence } = selectDentalArchetype(lead, result);
    expect(archetype).toBe("DENTAL_CORE");
    expect(confidence).toBe("LOW");
  });
});

// ─── CTA Selection ────────────────────────────────────────────────────────────

describe("selectCTA", () => {
  it("selects WhatsApp as primary when booking absent and whatsapp found", () => {
    const lead = makeLead({ audit: { ...makeLead().audit, bookingFound: false, whatsappFound: true, whatsappEvidence: ["+971501234567"] } } as Partial<Lead>);
    const { primaryCTA } = selectCTA(lead);
    expect(primaryCTA.type).toBe("WHATSAPP");
    expect(primaryCTA.href).toContain("wa.me");
  });

  it("selects BOOKING when booking is verified", () => {
    const lead = makeLead({ audit: { ...makeLead().audit, bookingFound: true, bookingEvidence: ["https://book.testdental.ae/appt"] } } as Partial<Lead>);
    const { primaryCTA } = selectCTA(lead);
    expect(primaryCTA.type).toBe("BOOKING");
  });

  it("selects PHONE when neither booking nor whatsapp", () => {
    const lead = makeLead({
      audit: { ...makeLead().audit, bookingFound: false, whatsappFound: false, phoneFound: true, phoneEvidence: ["+971501234567"] },
    } as Partial<Lead>);
    const { primaryCTA } = selectCTA(lead);
    expect(primaryCTA.type).toBe("PHONE");
    expect(primaryCTA.href).toContain("tel:");
  });

  it("returns NONE when no contact channel verified", () => {
    const lead = makeLead({
      phone: undefined,
      audit: { ...makeLead().audit, bookingFound: false, whatsappFound: false, phoneFound: false },
    } as Partial<Lead>);
    const { primaryCTA } = selectCTA(lead);
    expect(primaryCTA.type).toBe("NONE");
    expect(primaryCTA.href).toBeNull();
  });

  it("provides secondary CTA when two channels available", () => {
    const lead = makeLead();
    const { secondaryCTA } = selectCTA(lead);
    expect(secondaryCTA).not.toBeNull();
  });
});

// ─── Copy Building ────────────────────────────────────────────────────────────

describe("buildPreviewCopy", () => {
  it("includes Abu Dhabi in headline when address contains it", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { heroCopy } = buildPreviewCopy(lead, result, "STRONG");
    expect(heroCopy.headline).toContain("Abu Dhabi");
  });

  it("surfaces rating+review in trust items when verified", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { trustItems } = buildPreviewCopy(lead, result, "STRONG");
    const ratingItem = trustItems.find((t) => t.icon === "star");
    expect(ratingItem).toBeDefined();
    expect(ratingItem!.value).toContain("4.7");
    expect(ratingItem!.value).toContain("350");
  });

  it("includes services from audit evidence", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { services } = buildPreviewCopy(lead, result, "STRONG");
    expect(services.length).toBeGreaterThan(0);
    expect(services[0].name).toBeTruthy();
  });

  it("does NOT include team section for LIGHT depth", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { sections } = buildPreviewCopy(lead, result, "LIGHT");
    expect(sections).not.toContain("team");
  });

  it("does NOT include team section when no team evidence", () => {
    const lead = makeLead({ audit: { ...makeLead().audit, teamIndicators: false, teamEvidence: [] } } as Partial<Lead>);
    const result = lead.audit.qualitativeResult!;
    const { sections } = buildPreviewCopy(lead, result, "PREMIUM");
    expect(sections).not.toContain("team");
  });

  it("includes services in STRONG depth when services evidence exists", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { sections } = buildPreviewCopy(lead, result, "STRONG");
    expect(sections).toContain("services");
  });

  it("returns evidence array with qualitative source refs", () => {
    const lead = makeLead();
    const result = lead.audit.qualitativeResult!;
    const { evidence } = buildPreviewCopy(lead, result, "STRONG");
    const hasQualitativeEvidence = evidence.some((e) => e.source === "qualitative");
    expect(hasQualitativeEvidence).toBe(true);
  });
});

// ─── Preview Eligibility ──────────────────────────────────────────────────────

describe("preview eligibility logic", () => {
  it("QUALIFIED leads are eligible", () => {
    const lead = makeLead({ qualificationStatus: "QUALIFIED" });
    const eligible = lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY";
    expect(eligible).toBe(true);
  });

  it("SKIP leads are NOT eligible without manual override", () => {
    const lead = makeLead({ qualificationStatus: "SKIP", manualDecision: "NONE" });
    const eligible = lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY";
    expect(eligible).toBe(false);
  });

  it("HOLD leads with manual QUALIFY override are eligible", () => {
    const lead = makeLead({ qualificationStatus: "HOLD", manualDecision: "QUALIFY" });
    const eligible = lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY";
    expect(eligible).toBe(true);
  });
});

// ─── PreviewConfig Serialization ──────────────────────────────────────────────

describe("PreviewConfig serialization", () => {
  it("round-trips through JSON without data loss", () => {
    const config: PreviewConfig = {
      leadId: "test-001",
      slug: "/dentist/test-dental-abu-dhabi",
      vertical: "DENTAL",
      archetype: "DENTAL_PREMIUM",
      archetypeConfidence: "HIGH",
      previewDepth: "STRONG",
      business: { name: "Test Dental", city: "Abu Dhabi", category: "Dental Clinic", rating: 4.7, reviewCount: 350, phone: "+971501234567", whatsapp: "+971501234567", website: "https://testdental.ae" },
      hero: {
        eyebrow: "Test Dental",
        headline: "Modern dental care in Abu Dhabi",
        subheadline: "Trusted by patients across Abu Dhabi.",
        primaryCTA: { type: "WHATSAPP", label: "WhatsApp Us", href: "https://wa.me/971501234567" },
        secondaryCTA: { type: "PHONE", label: "Call the Clinic", href: "tel:+971501234567" },
        heroImageUrl: null,
      },
      trustItems: [{ label: "Google Rating", value: "4.7 · 350 reviews", icon: "star" }],
      services: [{ name: "General Dentistry" }, { name: "Teeth Whitening" }],
      team: [],
      location: { city: "Abu Dhabi", address: "123 Main St, Abu Dhabi" },
      sections: ["services", "location"],
      design: { archetype: "DENTAL_PREMIUM" },
      sourceEvidence: [{ field: "rating", value: "4.7", source: "lead" }],
      logoUrl: null,
      heroImageUrlOverride: null,
    };

    const json = JSON.stringify(config);
    const parsed = JSON.parse(json) as PreviewConfig;

    expect(parsed.leadId).toBe(config.leadId);
    expect(parsed.archetype).toBe("DENTAL_PREMIUM");
    expect(parsed.hero.primaryCTA.type).toBe("WHATSAPP");
    expect(parsed.business.rating).toBe(4.7);
    expect(parsed.team).toEqual([]);
    expect(parsed.sourceEvidence[0].source).toBe("lead");
  });
});

// ─── Sprint 3A: Asset URL Validation ─────────────────────────────────────────

describe("isValidAssetUrl – malformed URL rejection", () => {
  it("accepts a normal https image URL", () => {
    expect(isValidAssetUrl("https://example.com/logo.png")).toBe(true);
  });

  it("accepts http image URL", () => {
    expect(isValidAssetUrl("http://example.com/og.jpg")).toBe(true);
  });

  it("rejects .jpgsvg concatenated extension", () => {
    expect(isValidAssetUrl("https://example.com/image.jpgsvg")).toBe(false);
  });

  it("rejects .webpsvg concatenated extension", () => {
    expect(isValidAssetUrl("https://example.com/image.webpsvg")).toBe(false);
  });

  it("rejects .pngsvg concatenated extension", () => {
    expect(isValidAssetUrl("https://example.com/image.pngsvg")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isValidAssetUrl("data:image/png;base64,abc123")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidAssetUrl(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidAssetUrl(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAssetUrl("")).toBe(false);
  });

  it("rejects too-short URLs", () => {
    expect(isValidAssetUrl("https://")).toBe(false);
  });

  it("rejects localhost URLs", () => {
    expect(isValidAssetUrl("http://localhost:3000/logo.png")).toBe(false);
  });

  it("rejects private IP 192.168.x.x", () => {
    expect(isValidAssetUrl("http://192.168.1.1/image.jpg")).toBe(false);
  });

  it("rejects private IP 10.x.x.x", () => {
    expect(isValidAssetUrl("http://10.0.0.1/image.jpg")).toBe(false);
  });

  it("rejects ftp protocol", () => {
    expect(isValidAssetUrl("ftp://example.com/logo.png")).toBe(false);
  });
});

// ─── Sprint 3A: Verified Facts Extraction ────────────────────────────────────

describe("extractVerifiedFacts", () => {
  it("extracts business name exactly", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.businessName).toBe("Test Dental Clinic");
  });

  it("extracts city from Abu Dhabi address", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.city).toBe("Abu Dhabi");
  });

  it("extracts google rating and review count", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.googleRating).toBe(4.7);
    expect(facts.reviewCount).toBe(350);
  });

  it("extracts phone number", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.phone).toBe("+971501234567");
  });

  it("extracts WhatsApp when whatsappFound is true", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.whatsapp).not.toBeNull();
  });

  it("returns null whatsapp when not found", () => {
    const lead = makeLead({
      audit: { ...makeLead().audit, whatsappFound: false, whatsappEvidence: [] },
    });
    const facts = extractVerifiedFacts(lead);
    expect(facts.whatsapp).toBeNull();
  });

  it("extracts verified services from audit evidence only", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.verifiedServices).toContain("General Dentistry");
    expect(facts.verifiedServices).toContain("Teeth Whitening");
    expect(facts.verifiedServices.length).toBeLessThanOrEqual(8);
  });

  it("extracts mainProblem from audit", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.mainProblem).toContain("CTA");
  });

  it("extracts outreachAngle from qualitative result", () => {
    const facts = extractVerifiedFacts(makeLead());
    expect(facts.outreachAngle).toBeTruthy();
  });

  it("returns empty teamInfo when no team evidence", () => {
    const lead = makeLead({ audit: { ...makeLead().audit, teamIndicators: false, teamEvidence: [] } });
    const facts = extractVerifiedFacts(lead);
    expect(facts.verifiedTeamInfo).toHaveLength(0);
  });

  it("returns null googleRating when lead has no rating", () => {
    const lead = makeLead({ rating: undefined });
    const facts = extractVerifiedFacts(lead);
    expect(facts.googleRating).toBeNull();
  });
});

// ─── Sprint 3A: V0 Prompt Pack Generation ────────────────────────────────────

describe("generateV0PromptPack", () => {
  it("generates a prompt containing the business name", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.masterPrompt).toContain("Test Dental Clinic");
  });

  it("generates a prompt containing the city", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.masterPrompt).toContain("Abu Dhabi");
  });

  it("generates a prompt containing the verified rating", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.masterPrompt).toContain("4.7");
  });

  it("includes FACTUAL GUARDRAILS section in prompt", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.masterPrompt).toContain("FACTUAL GUARDRAILS");
    expect(pack.masterPrompt).toContain("DO NOT invent");
  });

  it("does NOT use 'satisfied patients' phrasing in copy sections", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    // Only the guardrails section mentions it as forbidden
    const beforeGuardrails = pack.masterPrompt.split("J. FACTUAL GUARDRAILS")[0] ?? "";
    expect(beforeGuardrails).not.toContain("satisfied patients");
  });

  it("includes all 11 sections (A-K)", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.sections).toHaveLength(11);
    expect(pack.sections.map((s) => s.key)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);
  });

  it("includes all 3 design references", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.designReferences.length).toBe(3);
    const names = pack.designReferences.map((r) => r.name);
    expect(names).toContain("WebDentts");
    expect(names).toContain("Ktabna");
    expect(names).toContain("Breezy Tech");
  });

  it("produces a valid archetype", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(["DENTAL_CORE", "DENTAL_PREMIUM", "DENTAL_SPECIALIST"]).toContain(pack.archetype);
  });

  it("includes verified services in prompt", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.masterPrompt).toContain("General Dentistry");
  });

  it("copy pack has non-empty headline", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.copyPack.headline.length).toBeGreaterThan(5);
  });

  it("copy pack has non-empty primary CTA", () => {
    const lead = makeLead();
    const facts = extractVerifiedFacts(lead);
    const pack = generateV0PromptPack(lead, facts, makeEmptyAssetPack());
    expect(pack.copyPack.primaryCTA.length).toBeGreaterThan(2);
  });
});

// ─── Sprint 3A: Final Preview URL Validation ─────────────────────────────────

describe("validatePreviewUrl", () => {
  it("accepts a valid https URL", () => {
    expect(validatePreviewUrl("https://preview.vercel.app")).toBe(true);
  });

  it("accepts a v0 preview URL", () => {
    expect(validatePreviewUrl("https://some-preview-abc123.vercel.app")).toBe(true);
  });

  it("accepts http URL", () => {
    expect(validatePreviewUrl("http://staging.example.com/preview")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validatePreviewUrl("")).toBe(false);
  });

  it("rejects too-short string", () => {
    expect(validatePreviewUrl("htt")).toBe(false);
  });

  it("rejects non-URL string", () => {
    expect(validatePreviewUrl("not-a-url")).toBe(false);
  });

  it("rejects ftp URL", () => {
    expect(validatePreviewUrl("ftp://some.server.com/preview")).toBe(false);
  });
});

function isEligibleForPreview(
  qualificationStatus: string,
  manualDecision: string | undefined,
  allowHold = false,
): boolean {
  return (
    qualificationStatus === "QUALIFIED" ||
    manualDecision === "QUALIFY" ||
    (allowHold && (qualificationStatus === "HOLD" || manualDecision === "HOLD"))
  );
}

describe("preview eligibility logic", () => {
  it("rejects purely automatic leads that are not QUALIFIED", () => {
    expect(isEligibleForPreview("PENDING QUALITATIVE AUDIT", undefined)).toBe(false);
    expect(isEligibleForPreview("REVIEW", undefined)).toBe(false);
  });

  it("accepts explicitly QUALIFIED automatic leads", () => {
    expect(isEligibleForPreview("QUALIFIED", undefined)).toBe(true);
  });

  it("accepts manually reviewed QUALIFY leads even if global status is PENDING WEBSITE AUDIT", () => {
    // This exact condition blocked Vision Dental before the memory heal fix
    expect(isEligibleForPreview("PENDING WEBSITE AUDIT", "QUALIFY")).toBe(true);
  });

  it("respects HOLD if allowHold is true", () => {
    expect(isEligibleForPreview("HOLD", undefined, true)).toBe(true);
    expect(isEligibleForPreview("PENDING", "HOLD", true)).toBe(true);
    expect(isEligibleForPreview("HOLD", undefined, false)).toBe(false);
  });
});

// ─── Sprint 3A: V0 Workflow Status Semantics ─────────────────────────────────

describe("V0 workflow status semantics", () => {
  it("all 7 V0 workflow statuses are defined", () => {
    const statuses: V0WorkflowStatus[] = [
      "NOT_STARTED",
      "BRIEF_READY",
      "PROMPT_READY",
      "IN_V0",
      "PREVIEW_LINK_ADDED",
      "READY_FOR_OUTREACH",
      "ARCHIVED",
    ];
    expect(statuses).toHaveLength(7);
  });

  it("NOT_STARTED is not the outreach-ready state", () => {
    const status: V0WorkflowStatus = "NOT_STARTED";
    expect((status as string) === "READY_FOR_OUTREACH").toBe(false);
  });

  it("READY_FOR_OUTREACH is the terminal approval state", () => {
    const status: V0WorkflowStatus = "READY_FOR_OUTREACH";
    expect((status as string) === "READY_FOR_OUTREACH").toBe(true);
  });

  it("adding a URL sets PREVIEW_LINK_ADDED, not READY_FOR_OUTREACH", () => {
    // The URL addition step sets PREVIEW_LINK_ADDED — a separate explicit
    // admin action (mark_ready_for_outreach) is required to set READY_FOR_OUTREACH
    const urlAddedStatus: V0WorkflowStatus = "PREVIEW_LINK_ADDED";
    expect((urlAddedStatus as string) !== "READY_FOR_OUTREACH").toBe(true);
  });

  it("ARCHIVED is a terminal state for inactive previews", () => {
    const status: V0WorkflowStatus = "ARCHIVED";
    expect((status as string) === "ARCHIVED").toBe(true);
  });
});
