import { calculateLeadScore, automaticQualificationFor, effectiveQualificationFor } from "../scoring";
import type { WebsiteAudit } from "../../types/audit";
import type { Lead } from "../../types/lead";
import type { QualitativeDimensionResult, QualitativeResult } from "../../types/qualitative";

const dimensionToAuditField = {
  mobileResponsive: "mobileScore",
  heroMessageClarity: "heroClarity",
  ctaContactBooking: "ctaScore",
  visualTrustDesign: "visualTrust",
  servicesNavigation: "servicesNavigation",
  speedPerformance: "speedScore",
  reviewsTeamTrust: "reviewsTrust",
  localSeoTechnical: "localSeo",
} as const;

function problemGroups(result: QualitativeResult) {
  const groups: Record<"CRITICAL" | "MAJOR" | "MINOR", string[]> = {
    CRITICAL: [],
    MAJOR: [],
    MINOR: [],
  };
  for (const dimension of Object.values(result.dimensions) as QualitativeDimensionResult[]) {
    if (dimension.severity !== "NONE") groups[dimension.severity].push(dimension.reason);
  }
  for (const problem of result.secondaryProblems) {
    if (problem.severity !== "NONE") groups[problem.severity].push(`${problem.title}: ${problem.evidence}`);
  }
  return {
    criticalProblems: [...new Set(groups.CRITICAL)].slice(0, 8),
    majorProblems: [...new Set(groups.MAJOR)].slice(0, 8),
    minorProblems: [...new Set(groups.MINOR)].slice(0, 8),
  };
}

function previewRecommendation(depth: QualitativeResult["recommendedPreviewDepth"]): Lead["previewRecommendation"] {
  if (depth === "NONE") return undefined;
  return `${depth} PREVIEW` as Lead["previewRecommendation"];
}

export function applyQualitativeResultToAudit(
  audit: WebsiteAudit,
  result: QualitativeResult,
  retryCount: number,
): WebsiteAudit {
  const problems = problemGroups(result);
  const next: WebsiteAudit = {
    ...audit,
    ...Object.fromEntries(Object.entries(dimensionToAuditField).map(([key, field]) => [field, result.dimensions[key as keyof typeof dimensionToAuditField].score])),
    qualitativeAuditStatus: "COMPLETE",
    qualitativeResult: result,
    qualitativeModel: result.modelVersion,
    qualitativeAnalyzedAt: result.analyzedAt,
    qualitativeCompletedAt: result.analyzedAt,
    qualitativeHeartbeatAt: result.analyzedAt,
    qualitativeRetryCount: retryCount,
    mainProblem: result.mainProblem,
    criticalProblems: problems.criticalProblems,
    majorProblems: problems.majorProblems,
    minorProblems: problems.minorProblems,
  };
  return next;
}

export function applyQualitativeResultToLead(
  lead: Lead,
  result: QualitativeResult,
  retryCount: number,
): Lead {
  const audit = applyQualitativeResultToAudit(lead.audit, result, retryCount);
  const next = {
    ...lead,
    audit,
    previewPotential: {
      realInformationAssets: result.previewPotential.realInformationAssets,
      clearServiceAngle: result.previewPotential.clearServiceAngle,
      transformationOpportunity: result.previewPotential.transformationOpportunity,
      personalizedCtaPotential: result.previewPotential.personalizedCtaPotential,
    },
    qualificationReason: result.qualificationReason,
    outreachAngle: result.outreachAngle,
    previewRecommendation: previewRecommendation(result.recommendedPreviewDepth),
    previewAngle: result.recommendedPreviewFocus,
    recommendedVariant: result.recommendedHeroAngle,
  };
  
  // Explicitly map manual reviews so they aren't lost
  if (result.qualificationDecisionSource === "MANUAL_REVIEW") {
    next.manualDecision = result.qualificationDecision;
    next.qualificationDecisionSource = "MANUAL_REVIEW";
  } else if (result.qualificationDecisionSource === "AI_QUALIFICATION") {
    next.qualificationDecisionSource = "AI_QUALIFICATION";
  }

  const score = calculateLeadScore(next);
  const automaticQualification = automaticQualificationFor({
    hasWebsite: next.hasWebsite,
    audit,
    score,
  });
  return {
    ...next,
    score,
    automaticQualification,
    qualificationStatus: effectiveQualificationFor(next.manualDecision, automaticQualification),
  };
}
