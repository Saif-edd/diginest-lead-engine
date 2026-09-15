export const auditStatuses = [
  "PENDING",
  "QUEUED",
  "AUDITING",
  "COMPLETE",
  "FAILED",
  "BLOCKED",
  "NOT REQUIRED",
] as const;
export type AuditStatus = (typeof auditStatuses)[number];

export const objectiveAuditStatuses = [
  "PENDING",
  "QUEUED",
  "AUDITING",
  "COMPLETE",
  "FAILED",
  "BLOCKED",
] as const;
export type ObjectiveAuditStatus = (typeof objectiveAuditStatuses)[number];

export const qualitativeAuditStatuses = [
  "NOT_READY",
  "PENDING",
  "ANALYZING",
  "COMPLETE",
  "FAILED",
] as const;
export type QualitativeAuditStatus = (typeof qualitativeAuditStatuses)[number];

export const qualitativeFailureReasons = [
  "INVALID_AI_OUTPUT",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "NOT_CONFIGURED",
  "LOW_CONFIDENCE",
] as const;
export type QualitativeFailureReason = (typeof qualitativeFailureReasons)[number];

export const auditFailureReasons = [
  "TIMEOUT",
  "DNS_ERROR",
  "SSL_ERROR",
  "HTTP_ERROR",
  "BLOCKED",
  "INVALID_URL",
  "BROWSER_ERROR",
  "STALE",
] as const;
export type AuditFailureReason = (typeof auditFailureReasons)[number];

export interface AuditPerformance {
  domContentLoadedMs?: number;
  loadEventMs?: number;
  measuredAt?: string;
}

export type AuditSignalName =
  | "phone"
  | "whatsapp"
  | "email"
  | "booking"
  | "contactForm"
  | "reviews"
  | "team"
  | "services"
  | "location"
  | "googleMaps"
  | "social";

export interface AuditSignalEvidence {
  exactText: string;
  element: string;
  href?: string;
  detectionRule: string;
  nearbyContext?: string;
  visible: boolean;
  sourceUrl: string;
}

export interface WebsiteAudit {
  objectiveAuditStatus?: ObjectiveAuditStatus;
  qualitativeAuditStatus?: QualitativeAuditStatus;
  /** @deprecated Use objectiveAuditStatus. Retained for Sprint 1 migration. */
  status: AuditStatus;
  simulated?: boolean;
  // Sprint 1 scoring fields remain optional until Sprint 2B qualitative calibration.
  mobileScore?: number;
  heroClarity?: number;
  ctaScore?: number;
  visualTrust?: number;
  servicesNavigation?: number;
  speedScore?: number;
  reviewsTrust?: number;
  localSeo?: number;
  criticalProblems?: string[];
  majorProblems?: string[];
  minorProblems?: string[];
  mainProblem?: string;
  requestedUrl?: string;
  finalUrl?: string;
  httpStatus?: number;
  https?: boolean;
  redirectCount?: number;
  pageReachable?: boolean;
  pageTitle?: string;
  metaDescription?: string;
  h1?: string[];
  canonical?: string;
  robotsMeta?: string;
  mobileViewport?: boolean;
  schemaTypes?: string[];
  language?: string;
  performance?: AuditPerformance;
  screenshotPath?: string;
  screenshotUrl?: string;
  screenshotError?: string;
  auditTimestamp?: string;
  startedAt?: string;
  completedAt?: string;
  heartbeatAt?: string;
  phoneFound?: boolean;
  phoneEvidence?: string[];
  whatsappFound?: boolean;
  whatsappEvidence?: string[];
  emailFound?: boolean;
  emailEvidence?: string[];
  bookingFound?: boolean;
  bookingEvidence?: string[];
  contactFormFound?: boolean;
  contactFormEvidence?: string[];
  primaryCtaText?: string[];
  googleMapsFound?: boolean;
  googleMapsEvidence?: string[];
  socialFound?: boolean;
  socialEvidence?: string[];
  reviewsIndicators?: boolean;
  reviewsEvidence?: string[];
  teamIndicators?: boolean;
  teamEvidence?: string[];
  servicesIndicators?: boolean;
  servicesEvidence?: string[];
  locationIndicators?: boolean;
  locationEvidence?: string[];
  /** Element-level evidence for every positive deterministic signal. */
  signalEvidence?: Partial<Record<AuditSignalName, AuditSignalEvidence[]>>;
  failureReason?: AuditFailureReason;
  failureMessage?: string;
  retryCount?: number;
  lastAttemptAt?: string;
  qualitativeResult?: import("./qualitative").QualitativeResult;
  qualitativeModel?: string;
  qualitativeAnalyzedAt?: string;
  qualitativeStartedAt?: string;
  qualitativeCompletedAt?: string;
  qualitativeHeartbeatAt?: string;
  qualitativeRetryCount?: number;
  qualitativeFailureReason?: QualitativeFailureReason;
  qualitativeFailureMessage?: string;
}
