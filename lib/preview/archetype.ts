/**
 * Deterministic archetype selector for dental leads.
 *
 * Input: qualitative result + lead data
 * Output: { archetype, confidence }
 *
 * Logic:
 * DENTAL_PREMIUM  → recommendedPreviewDepth === PREMIUM
 *                   OR (rating >= 4.7 AND reviewCount >= 200 AND strong transformation potential)
 * DENTAL_SPECIALIST → verified specialty detected from services/category evidence
 * DENTAL_CORE     → default
 */

import type { Lead } from "@/types/lead";
import type { QualitativeResult } from "@/types/qualitative";
import type { DentalArchetype, ArchetypeConfidence } from "@/types/preview";

const SPECIALIST_KEYWORDS = [
  "orthodont",
  "implant",
  "cosmetic dent",
  "aesthetic dent",
  "pediatric dent",
  "oral surgeon",
  "oral surgery",
  "endodont",
  "periodon",
  "prosthodont",
  "aligner",
  "invisalign",
  "clear aligner",
];

function hasVerifiedSpecialty(lead: Lead, result: QualitativeResult): boolean {
  const sources = [
    lead.category,
    lead.name,
    ...(lead.audit.servicesEvidence ?? []),
    ...(lead.audit.h1 ?? []),
    result.outreachAngle,
    result.recommendedPreviewFocus,
    result.recommendedHeroAngle,
    result.mainProblem,
    ...(result.recommendedSections ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return SPECIALIST_KEYWORDS.some((kw) => sources.includes(kw));
}

function isPremiumCandidate(lead: Lead, result: QualitativeResult): boolean {
  if (result.recommendedPreviewDepth === "PREMIUM") return true;

  const rating = lead.rating ?? 0;
  const reviews = lead.totalRatings ?? 0;
  const transformationPotential =
    result.previewPotential.transformationOpportunity;

  // Strong commercial trust + transformation potential
  return rating >= 4.7 && reviews >= 200 && transformationPotential >= 7;
}

export function selectDentalArchetype(
  lead: Lead,
  result: QualitativeResult,
): { archetype: DentalArchetype; confidence: ArchetypeConfidence } {
  const isPremium = isPremiumCandidate(lead, result);
  const isSpecialist = hasVerifiedSpecialty(lead, result);

  // SPECIALIST takes precedence only when clearly not-PREMIUM, because a
  // specialist clinic can still get the PREMIUM template.
  // Priority: if both specialist AND premium signals → PREMIUM (richer layout).
  if (isPremium) {
    const confidence: ArchetypeConfidence =
      result.recommendedPreviewDepth === "PREMIUM" ? "HIGH" : "MEDIUM";
    return { archetype: "DENTAL_PREMIUM", confidence };
  }

  if (isSpecialist) {
    // Confidence depends on strength of specialty evidence
    const nameMatch = SPECIALIST_KEYWORDS.some((kw) =>
      (lead.name + " " + lead.category).toLowerCase().includes(kw),
    );
    const confidence: ArchetypeConfidence = nameMatch ? "HIGH" : "MEDIUM";
    return { archetype: "DENTAL_SPECIALIST", confidence };
  }

  // CORE: check if we have enough evidence for HIGH confidence
  const hasWebsite = lead.hasWebsite;
  const hasAudit = lead.audit.objectiveAuditStatus === "COMPLETE";
  const hasQualitative = lead.audit.qualitativeAuditStatus === "COMPLETE";
  const confidence: ArchetypeConfidence =
    hasWebsite && hasAudit && hasQualitative ? "HIGH" : "LOW";

  return { archetype: "DENTAL_CORE", confidence };
}
