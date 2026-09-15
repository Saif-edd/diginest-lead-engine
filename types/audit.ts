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

export const auditFailureReasons = [
  "TIMEOUT",
  "DNS_ERROR",
  "SSL_ERROR",
  "HTTP_ERROR",
  "BLOCKED",
  "INVALID_URL",
  "BROWSER_ERROR",
] as const;
export type AuditFailureReason = (typeof auditFailureReasons)[number];

export interface AuditPerformance {
  domContentLoadedMs?: number;
  loadEventMs?: number;
  measuredAt?: string;
}

export interface WebsiteAudit {
  status: AuditStatus;
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
  auditTimestamp?: string;
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
  failureReason?: AuditFailureReason;
  failureMessage?: string;
  retryCount?: number;
  lastAttemptAt?: string;
}
