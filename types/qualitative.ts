import type { ProblemSeverity } from "./lead";

export const qualitativeDimensionDefinitions = [
  { key: "mobileResponsive", label: "Mobile / Responsive", maxScore: 6 },
  { key: "heroMessageClarity", label: "Hero / Message Clarity", maxScore: 5 },
  { key: "ctaContactBooking", label: "CTA / Contact / Booking", maxScore: 8 },
  { key: "visualTrustDesign", label: "Visual Trust / Design Quality", maxScore: 6 },
  { key: "servicesNavigation", label: "Services / Navigation", maxScore: 4 },
  { key: "speedPerformance", label: "Speed / Performance Impression", maxScore: 4 },
  { key: "reviewsTeamTrust", label: "Reviews / Team / Trust Presentation", maxScore: 3 },
  { key: "localSeoTechnical", label: "Local SEO / Technical Quality", maxScore: 4 },
] as const;

export type QualitativeDimensionKey =
  (typeof qualitativeDimensionDefinitions)[number]["key"];
export type QualitativeConfidence = "HIGH" | "MEDIUM" | "LOW";
export type QualificationDecision = "QUALIFY" | "HOLD" | "SKIP";
export type PreviewDepth = "NONE" | "LIGHT" | "STRONG" | "PREMIUM";

export interface QualitativeEvidenceReference {
  source: "lead" | "audit" | "signal" | "screenshot";
  field: string;
  detail: string;
}

export interface QualitativeDimensionResult {
  score: number;
  maxScore: number;
  severity: ProblemSeverity;
  reason: string;
  evidenceUsed: QualitativeEvidenceReference[];
  confidence: QualitativeConfidence;
}

export interface QualitativeScoredComponent {
  score: number;
  maxScore: number;
  evidenceUsed: QualitativeEvidenceReference[];
  confidence: QualitativeConfidence;
}

export interface QualitativePreviewPotential {
  realInformationAssets: number;
  clearServiceAngle: number;
  transformationOpportunity: number;
  personalizedCtaPotential: number;
  total: number;
  reviewed: true;
  evidenceUsed: QualitativeEvidenceReference[];
  confidence: QualitativeConfidence;
}

export interface QualitativeOpportunityGate {
  passes: boolean;
  criticalCount: number;
  majorCount: number;
  reason: string;
}

export interface QualitativeSecondaryProblem {
  title: string;
  severity: ProblemSeverity;
  evidence: string;
}

export interface QualitativeResult {
  schemaVersion: "sprint-2b.v1";
  modelVersion: string;
  analyzedAt: string;
  dimensions: Record<QualitativeDimensionKey, QualitativeDimensionResult>;
  websiteOpportunityScore: number;
  opportunityGate: QualitativeOpportunityGate;
  mainProblem: string;
  mainProblemSeverity: ProblemSeverity;
  secondaryProblems: QualitativeSecondaryProblem[];
  qualificationDecision: QualificationDecision;
  qualificationReason: string;
  commercialProfile: QualitativeScoredComponent;
  commercialProfileScore: number;
  previewPotential: QualitativePreviewPotential;
  outreachAngle: string;
  recommendedPreviewDepth: PreviewDepth;
  recommendedPreviewFocus: string;
  recommendedCTA: string;
  recommendedHeroAngle: string;
  recommendedSections: string[];
}

