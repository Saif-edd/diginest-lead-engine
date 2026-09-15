import { describe, expect, it } from "vitest";
import {
  automaticQualificationFor,
  calculateLeadScore,
  effectiveQualificationFor,
  noWebsiteOpportunityScore,
  priorityForScore,
  ratingScore,
  reviewVolumeScore,
  websiteOpportunityScore,
} from "../lib/scoring";

const base = {
  category: "Dentist",
  rating: 4.8,
  totalRatings: 500,
  hasWebsite: true,
  audit: {
    status: "COMPLETE" as const,
    mobileScore: 3,
    heroClarity: 3,
    ctaScore: 4,
    visualTrust: 3,
    servicesNavigation: 2,
    speedScore: 2,
    reviewsTrust: 1,
    localSeo: 2,
    criticalProblems: ["Broken booking"],
    majorProblems: ["Weak CTA", "Buried services"],
    minorProblems: [],
  },
  reachability: { hasPhone: true, hasEmail: true, hasSocial: true },
  previewPotential: {
    realInformationAssets: 5,
    clearServiceAngle: 5,
    transformationOpportunity: 5,
    personalizedCtaPotential: 5,
  },
};

describe("score thresholds", () => {
  it("maps rating thresholds exactly", () => {
    expect(ratingScore(5)).toBe(5);
    expect(ratingScore(4.7)).toBe(4);
    expect(ratingScore(4.3)).toBe(3);
    expect(ratingScore(4.1)).toBe(1);
    expect(ratingScore(3.9)).toBe(0);
    expect(ratingScore(undefined)).toBe(0);
  });

  it("maps review volume thresholds exactly", () => {
    expect(reviewVolumeScore(500)).toBe(10);
    expect(reviewVolumeScore(200)).toBe(8);
    expect(reviewVolumeScore(75)).toBe(6);
    expect(reviewVolumeScore(25)).toBe(4);
    expect(reviewVolumeScore(10)).toBe(2);
    expect(reviewVolumeScore(9)).toBe(0);
  });

  it("assigns priority bands", () => {
    expect(priorityForScore(100)).toBe("P1 ULTRA");
    expect(priorityForScore(80)).toBe("P1 PREMIUM");
    expect(priorityForScore(65)).toBe("P2 STRONG");
    expect(priorityForScore(50)).toBe("P3 QUALIFIED");
    expect(priorityForScore(49)).toBe("P4 LOW");
  });
});

describe("qualification rules", () => {
  it("confirms a website opportunity with one critical or two major problems", () => {
    const completeAudit = {
      status: "COMPLETE" as const,
      mobileScore: 3,
      heroClarity: 3,
      ctaScore: 4,
      visualTrust: 3,
      servicesNavigation: 2,
      speedScore: 2,
      reviewsTrust: 1,
      localSeo: 2,
      criticalProblems: [],
      majorProblems: [],
      minorProblems: [],
    };
    expect(
      websiteOpportunityScore({
        ...completeAudit,
        criticalProblems: ["Broken CTA"],
      }).confirmed,
    ).toBe(true);
    expect(
      websiteOpportunityScore({
        ...completeAudit,
        majorProblems: ["Weak CTA", "Slow page"],
      }).confirmed,
    ).toBe(true);
    expect(
      websiteOpportunityScore({
        ...completeAudit,
        majorProblems: ["Weak CTA"],
        minorProblems: ["Small type"],
      }).confirmed,
    ).toBe(false);
  });

  it("keeps the website score provisional until all audit dimensions exist", () => {
    const partialAudit = {
      status: "COMPLETE" as const,
      criticalProblems: ["Broken CTA"],
      majorProblems: [],
      minorProblems: [],
    };
    expect(websiteOpportunityScore(partialAudit).complete).toBe(false);
    const score = calculateLeadScore({ ...base, audit: partialAudit });
    expect(score.isFinal).toBe(false);
    expect(
      automaticQualificationFor({
        hasWebsite: true,
        audit: partialAudit,
        score,
      }),
    ).toBe("PENDING WEBSITE AUDIT");
  });

  it("keeps even an objectively audited website pending qualitative review", () => {
    const score = calculateLeadScore(base);
    expect(score.isFinal).toBe(false);
    expect(score.pendingComponents).toContain("Qualitative audit (Sprint 2B)");
    expect(
      automaticQualificationFor({ hasWebsite: true, audit: base.audit, score }),
    ).toBe("PENDING QUALITATIVE AUDIT");
  });

  it("does not qualify a business from no website alone", () => {
    const result = noWebsiteOpportunityScore(
      { strongBusinessPresence: 0, commercialPotential: 0, digitalGap: 5 },
      { rating: 4.8, totalRatings: 500 },
    );
    expect(result.score).toBe(25);
    expect(result.confirmed).toBe(false);
  });

  it("keeps categories as a context signal", () => {
    const score = calculateLeadScore({ ...base, category: "Massage" });
    expect(score.categoryContext).toBeGreaterThan(0);
    expect(score.opportunityConfirmed).toBe(true);
  });

  it("supports pending audit and manual overrides", () => {
    const score = calculateLeadScore({
      ...base,
      audit: {
        ...base.audit,
        status: "PENDING",
        criticalProblems: [],
        majorProblems: [],
      },
    });
    expect(
      automaticQualificationFor({
        hasWebsite: true,
        audit: {
          ...base.audit,
          status: "PENDING",
          criticalProblems: [],
          majorProblems: [],
        },
        score,
      }),
    ).toBe("PENDING WEBSITE AUDIT");
    expect(effectiveQualificationFor("QUALIFY", "REVIEW")).toBe("QUALIFIED");
    expect(effectiveQualificationFor("HOLD", "QUALIFIED")).toBe("HOLD");
    expect(effectiveQualificationFor("SKIP", "QUALIFIED")).toBe("SKIP");
  });
});
