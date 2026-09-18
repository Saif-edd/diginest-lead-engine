import {
  qualitativeDimensionDefinitions,
  type QualitativeConfidence,
  type QualitativeDimensionKey,
  type QualitativeEvidenceReference,
  type QualitativeResult,
  type QualitativeSecondaryProblem,
  type QualitativeScoredComponent,
  type PreviewDepth,
  type QualificationDecision,
} from "../../types/qualitative";
import type { ProblemSeverity } from "../../types/lead";

const severities = new Set<ProblemSeverity>(["NONE", "MINOR", "MAJOR", "CRITICAL"]);
const confidences = new Set<QualitativeConfidence>(["HIGH", "MEDIUM", "LOW"]);
const decisions = new Set<QualificationDecision>(["QUALIFY", "HOLD", "SKIP"]);
const previewDepths = new Set<PreviewDepth>(["NONE", "LIGHT", "STRONG", "PREMIUM"]);
const signalNames = new Set([
  "phone", "whatsapp", "email", "booking", "contactForm", "reviews", "team",
  "services", "location", "googleMaps", "social",
]);
const leadFields = new Set([
  "name", "category", "address", "city", "rating", "reviewCount",
  "phone", "email", "socialUrl",
]);
const auditFields = new Set([
  "requestedUrl", "finalUrl", "httpStatus", "https", "redirectCount",
  "pageReachable", "pageTitle", "metaDescription", "h1", "canonical",
  "robotsMeta", "mobileViewport", "schemaTypes", "language", "performance",
  "auditTimestamp",
]);

export class QualitativeValidationError extends Error {
  readonly code = "INVALID_AI_OUTPUT" as const;
}

function fail(message: string): never {
  throw new QualitativeValidationError(message);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string, maxLength = 800) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim().slice(0, maxLength);
}

function numberValue(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    fail(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, field: string, values: Set<T>): T {
  if (typeof value !== "string" || !values.has(value as T)) fail(`${field} is invalid`);
  return value as T;
}

function evidence(value: unknown, field: string): QualitativeEvidenceReference[] {
  if (!Array.isArray(value) || value.length > 8) fail(`${field} must be an array with at most 8 items`);
  return value.map((item, index) => {
    const entry = record(item, `${field}[${index}]`);
    const source = enumValue(entry.source, `${field}[${index}].source`, new Set(["lead", "audit", "signal", "screenshot"] as const));
    const sourceField = stringValue(entry.field, `${field}[${index}].field`, 120);
    if (source === "lead" && !leadFields.has(sourceField)) fail(`${field}[${index}] references an unavailable lead field`);
    if (source === "audit" && !auditFields.has(sourceField)) fail(`${field}[${index}] references an unavailable audit field`);
    if (source === "signal" && ![...signalNames].some((name) => sourceField === name || sourceField.startsWith(`${name}[`))) fail(`${field}[${index}] references an unavailable signal`);
    if (source === "screenshot" && sourceField !== "homepage") fail(`${field}[${index}] references an unavailable screenshot field`);
    return {
      source,
      field: sourceField,
      detail: stringValue(entry.detail, `${field}[${index}].detail`, 800),
    };
  });
}

function dimension(value: unknown, key: QualitativeDimensionKey, maxScore: number) {
  if (typeof value !== "object" || value === null) {
    throw new QualitativeValidationError(`Invalid dimension object at dimensions.${key}`);
  }
  const entry = value as Record<string, unknown>;
  return {
    score: numberValue(entry.score, `dimensions.${key}.score`, 0, maxScore),
    maxScore: maxScore,
    severity: enumValue(entry.severity, `dimensions.${key}.severity`, severities),
    reason: stringValue(entry.reason, `dimensions.${key}.reason`),
    evidenceUsed: evidence(entry.evidenceUsed, `dimensions.${key}.evidenceUsed`),
    confidence: enumValue(entry.confidence, `dimensions.${key}.confidence`, confidences),
  };
}

function scoredComponent(value: unknown, field: string, maxScore: number): QualitativeScoredComponent {
  if (typeof value !== "object" || value === null) {
    throw new QualitativeValidationError(`Invalid scored component at ${field}`);
  }
  const entry = value as Record<string, unknown>;
  return {
    score: numberValue(entry.score, `${field}.score`, 0, maxScore),
    maxScore: maxScore,
    evidenceUsed: evidence(entry.evidenceUsed, `${field}.evidenceUsed`),
    confidence: enumValue(entry.confidence, `${field}.confidence`, confidences),
  };
}

function previewPotential(value: unknown) {
  const entry = record(value, "previewPotential");
  const scores = {
    realInformationAssets: numberValue(entry.realInformationAssets, "previewPotential.realInformationAssets", 0, 5),
    clearServiceAngle: numberValue(entry.clearServiceAngle, "previewPotential.clearServiceAngle", 0, 5),
    transformationOpportunity: numberValue(entry.transformationOpportunity, "previewPotential.transformationOpportunity", 0, 5),
    personalizedCtaPotential: numberValue(entry.personalizedCtaPotential, "previewPotential.personalizedCtaPotential", 0, 5),
  };
  return {
    ...scores,
    total: Object.values(scores).reduce((sum, score) => sum + score, 0),
    reviewed: true as const,
    evidenceUsed: evidence(entry.evidenceUsed, "previewPotential.evidenceUsed"),
    confidence: enumValue(entry.confidence, "previewPotential.confidence", confidences),
  };
}

export function normalizeQualitativeResult(
  value: unknown,
  modelVersion: string,
  analyzedAt: string,
): QualitativeResult {
  const input = record(value, "qualitative result");
  if (input.schemaVersion !== "sprint-2b.v1") fail("schemaVersion must be sprint-2b.v1");
  const rawDimensions = record(input.dimensions, "dimensions");
  const dimensions = {} as QualitativeResult["dimensions"];
  for (const definition of qualitativeDimensionDefinitions) {
    dimensions[definition.key] = dimension(rawDimensions[definition.key], definition.key, definition.maxScore);
  }
  const scores = Object.values(dimensions).map((item) => item.score);
  const criticalCount = Object.values(dimensions).filter((item) => item.severity === "CRITICAL").length;
  const majorCount = Object.values(dimensions).filter((item) => item.severity === "MAJOR").length;
  const passes = criticalCount >= 1 || majorCount >= 2;
  const rawSecondary = input.secondaryProblems;
  if (!Array.isArray(rawSecondary) || rawSecondary.length > 3) fail("secondaryProblems must contain at most 3 items");
  const secondaryProblems: QualitativeSecondaryProblem[] = rawSecondary.map((item, index) => {
    const entry = record(item, `secondaryProblems[${index}]`);
    return {
      title: stringValue(entry.title, `secondaryProblems[${index}].title`, 160),
      severity: enumValue(entry.severity, `secondaryProblems[${index}].severity`, severities),
      evidence: stringValue(entry.evidence, `secondaryProblems[${index}].evidence`),
    };
  });
  const commercialProfile = scoredComponent(input.commercialProfile, "commercialProfile", 5);
  const preview = previewPotential(input.previewPotential);
  const requestedDecision = enumValue(input.qualificationDecision, "qualificationDecision", decisions);
  const qualificationDecision = requestedDecision === "QUALIFY" && !passes ? "HOLD" : requestedDecision;
  return {
    schemaVersion: "sprint-2b.v1",
    modelVersion: modelVersion.trim() || "unknown",
    analyzedAt,
    dimensions,
    websiteOpportunityScore: scores.reduce((sum, score) => sum + score, 0),
    opportunityGate: {
      passes,
      criticalCount,
      majorCount,
      reason: passes
        ? "At least one critical or two major qualitative problems were identified."
        : "The reviewed evidence does not meet the opportunity threshold.",
    },
    mainProblem: stringValue(input.mainProblem, "mainProblem", 240),
    mainProblemSeverity: enumValue(input.mainProblemSeverity, "mainProblemSeverity", severities),
    secondaryProblems,
    qualificationDecision,
    qualificationReason: stringValue(input.qualificationReason, "qualificationReason"),
    commercialProfile,
    commercialProfileScore: commercialProfile.score,
    previewPotential: preview,
    outreachAngle: stringValue(input.outreachAngle, "outreachAngle", 400),
    recommendedPreviewDepth: enumValue(input.recommendedPreviewDepth, "recommendedPreviewDepth", previewDepths),
    recommendedPreviewFocus: stringValue(input.recommendedPreviewFocus, "recommendedPreviewFocus", 300),
    recommendedCTA: stringValue(input.recommendedCTA, "recommendedCTA", 200),
    recommendedHeroAngle: stringValue(input.recommendedHeroAngle, "recommendedHeroAngle", 300),
    recommendedSections: (() => {
      if (!Array.isArray(input.recommendedSections) || input.recommendedSections.length > 8) fail("recommendedSections must contain at most 8 items");
      return input.recommendedSections.map((item, index) => stringValue(item, `recommendedSections[${index}]`, 120));
    })(),
  };
}
