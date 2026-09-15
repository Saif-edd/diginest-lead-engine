import type { AuditStatus, WebsiteAudit } from "../../types/audit";

export function emptyWebsiteAudit(
  status: AuditStatus = "PENDING",
  requestedUrl?: string,
): WebsiteAudit {
  const objectiveAuditStatus = status === "NOT REQUIRED" ? "PENDING" : status;
  return {
    objectiveAuditStatus,
    qualitativeAuditStatus:
      objectiveAuditStatus === "COMPLETE" ? "PENDING" : "NOT_READY",
    status,
    requestedUrl,
    h1: [],
    schemaTypes: [],
    criticalProblems: [],
    majorProblems: [],
    minorProblems: [],
    phoneFound: false,
    phoneEvidence: [],
    whatsappFound: false,
    whatsappEvidence: [],
    emailFound: false,
    emailEvidence: [],
    bookingFound: false,
    bookingEvidence: [],
    contactFormFound: false,
    contactFormEvidence: [],
    primaryCtaText: [],
    googleMapsFound: false,
    googleMapsEvidence: [],
    socialFound: false,
    socialEvidence: [],
    reviewsIndicators: false,
    reviewsEvidence: [],
    teamIndicators: false,
    teamEvidence: [],
    servicesIndicators: false,
    servicesEvidence: [],
    locationIndicators: false,
    locationEvidence: [],
    retryCount: 0,
  };
}
