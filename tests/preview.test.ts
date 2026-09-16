/**
 * Preview Builder Tests – Day 6
 * Tests: eligibility, slug, archetype, CTA, depth sections, config serialization
 */

import { describe, it, expect } from "vitest";
import { generateSlug, slugPathSegment } from "../lib/preview/slug";
import { selectDentalArchetype } from "../lib/preview/archetype";
import { selectCTA } from "../lib/preview/cta";
import { buildPreviewCopy } from "../lib/preview/copy";
import type { Lead } from "../types/lead";
import type { QualitativeResult } from "../types/qualitative";
import type { PreviewConfig } from "../types/preview";

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
    // Ensure no specialist keywords in any evidence field
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
      audit: {
        ...makeLead().audit,
        bookingFound: false,
        whatsappFound: false,
        phoneFound: true,
        phoneEvidence: ["+971501234567"],
      },
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
