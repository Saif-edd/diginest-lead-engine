import type { Lead, Priority, WebsiteAudit } from "../../types/lead";

export const SCORE_MAX = {
  businessStrength: 25,
  opportunity: 40,
  reachability: 15,
  previewPotential: 20,
} as const;

export function ratingScore(rating?: number): number {
  if (rating == null || Number.isNaN(rating)) return 0;
  if (rating >= 4.8) return 5;
  if (rating >= 4.6) return 4;
  if (rating >= 4.3) return 3;
  if (rating >= 4.0) return 1;
  return 0;
}

export function reviewVolumeScore(totalRatings?: number): number {
  if (totalRatings == null || Number.isNaN(totalRatings)) return 0;
  if (totalRatings >= 500) return 10;
  if (totalRatings >= 200) return 8;
  if (totalRatings >= 75) return 6;
  if (totalRatings >= 25) return 4;
  if (totalRatings >= 10) return 2;
  return 0;
}

export function priorityForScore(total: number): Priority {
  if (total >= 90) return "P1 ULTRA";
  if (total >= 80) return "P1 PREMIUM";
  if (total >= 65) return "P2 STRONG";
  if (total >= 50) return "P3 QUALIFIED";
  return "P4 LOW";
}

function clamp(score: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(score)));
}

export function websiteOpportunityScore(audit: WebsiteAudit) {
  const requiredDimensions = [
    audit.mobileScore,
    audit.heroClarity,
    audit.ctaScore,
    audit.visualTrust,
    audit.servicesNavigation,
    audit.speedScore,
    audit.reviewsTrust,
    audit.localSeo,
  ];
  const complete =
    audit.status === "COMPLETE" &&
    requiredDimensions.every((value) => value != null);
  const score =
    clamp(audit.mobileScore ?? 0, 6) +
    clamp(audit.heroClarity ?? 0, 5) +
    clamp(audit.ctaScore ?? 0, 8) +
    clamp(audit.visualTrust ?? 0, 6) +
    clamp(audit.servicesNavigation ?? 0, 4) +
    clamp(audit.speedScore ?? 0, 4) +
    clamp(audit.reviewsTrust ?? 0, 3) +
    clamp(audit.localSeo ?? 0, 4);
  const criticalCount = audit.criticalProblems?.length ?? 0;
  const majorCount = audit.majorProblems?.length ?? 0;
  return {
    score,
    complete,
    confirmed: complete && (criticalCount >= 1 || majorCount >= 2),
  };
}

export function noWebsiteOpportunityScore(
  input: NonNullable<Lead["noWebsiteOpportunity"]>,
  lead: Pick<Lead, "rating" | "totalRatings">,
) {
  const score =
    20 +
    clamp(input.strongBusinessPresence, 8) +
    clamp(input.commercialPotential, 7) +
    clamp(input.digitalGap, 5);
  // A missing website is a signal, not a qualification by itself. The business must look active and commercially reachable.
  const confirmed =
    input.strongBusinessPresence >= 4 &&
    input.commercialPotential >= 3 &&
    (lead.rating ?? 0) >= 4.0 &&
    (lead.totalRatings ?? 0) >= 10;
  return { score, complete: true, confirmed };
}

export function reachabilityScore(reachability: Lead["reachability"]): number {
  const channels = [
    reachability.hasPhone,
    reachability.hasEmail,
    reachability.hasSocial,
  ].filter(Boolean).length;
  return (
    (reachability.hasPhone ? 6 : 0) +
    (reachability.hasEmail ? 4 : 0) +
    (reachability.hasSocial ? 3 : 0) +
    (channels >= 2 ? 2 : 0)
  );
}

export function previewPotentialScore(
  potential: Lead["previewPotential"],
): number {
  return (
    clamp(potential.realInformationAssets, 5) +
    clamp(potential.clearServiceAngle, 5) +
    clamp(potential.transformationOpportunity, 5) +
    clamp(potential.personalizedCtaPotential, 5)
  );
}

export function calculateLeadScore(
  lead: Pick<
    Lead,
    | "category"
    | "rating"
    | "totalRatings"
    | "hasWebsite"
    | "audit"
    | "noWebsiteOpportunity"
    | "reachability"
    | "previewPotential"
  >,
): Lead["score"] {
  const categoryContext = lead.category ? 3 : 0;
  const rating = ratingScore(lead.rating);
  const reviewVolume = reviewVolumeScore(lead.totalRatings);
  const commercialProfile = lead.hasWebsite
    ? 4
    : (lead.noWebsiteOpportunity?.commercialPotential ?? 0);
  const businessStrength =
    clamp(categoryContext, 5) +
    rating +
    reviewVolume +
    clamp(commercialProfile, 5);

  const opportunityResult = lead.hasWebsite
    ? websiteOpportunityScore(lead.audit)
    : noWebsiteOpportunityScore(
        lead.noWebsiteOpportunity ?? {
          strongBusinessPresence: 0,
          commercialPotential: 0,
          digitalGap: 0,
        },
        lead,
      );
  const reachability = reachabilityScore(lead.reachability);
  const previewPotential = previewPotentialScore(lead.previewPotential);
  const total =
    businessStrength +
    opportunityResult.score +
    reachability +
    previewPotential;
  const pendingComponents = lead.hasWebsite
    ? [
        ...(!opportunityResult.complete ? ["Website audit evidence"] : []),
        "Qualitative audit (Sprint 2B)",
      ]
    : [];
  return {
    businessStrength,
    categoryContext,
    rating,
    reviewVolume,
    commercialProfile,
    opportunity: opportunityResult.score,
    reachability,
    previewPotential,
    total,
    opportunityConfirmed: opportunityResult.confirmed,
    priority: priorityForScore(total),
    isFinal: pendingComponents.length === 0,
    pendingComponents,
  };
}

export function automaticQualificationFor(
  lead: Pick<Lead, "hasWebsite" | "audit" | "score">,
): Lead["automaticQualification"] {
  if (
    lead.hasWebsite &&
    lead.score.pendingComponents.includes("Website audit evidence")
  )
    return "PENDING WEBSITE AUDIT";
  if (lead.hasWebsite) return "PENDING QUALITATIVE AUDIT";
  if (lead.score.opportunityConfirmed && lead.score.total >= 50)
    return "QUALIFIED";
  return "REVIEW";
}

export function effectiveQualificationFor(
  manualDecision: Lead["manualDecision"],
  automatic: Lead["automaticQualification"],
): Lead["qualificationStatus"] {
  if (manualDecision === "QUALIFY") return "QUALIFIED";
  if (manualDecision === "HOLD") return "HOLD";
  if (manualDecision === "SKIP") return "SKIP";
  return automatic;
}
