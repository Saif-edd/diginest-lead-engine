import { readAuditScreenshot } from "../storage/screenshots";
import type { WebsiteAudit } from "../../types/audit";
import type { Lead } from "../../types/lead";
import { normalizeQualitativeResult } from "./schema";
import { createQualitativeProvider, type QualitativeProvider } from "./provider";

export interface QualitativeAnalysisContext {
  business: {
    name: string;
    category: string;
    address: string;
    rating?: number;
    reviewCount?: number;
    phone?: string;
    email?: string;
    socialUrl?: string;
  };
  objectiveAudit: {
    objectiveAuditStatus?: string;
    requestedUrl?: string;
    finalUrl?: string;
    httpStatus?: number;
    https?: boolean;
    redirectCount?: number;
    pageReachable?: boolean;
    pageTitle?: string;
    metaDescription?: string;
    h1: string[];
    canonical?: string;
    robotsMeta?: string;
    mobileViewport?: boolean;
    schemaTypes: string[];
    language?: string;
    performance?: WebsiteAudit["performance"];
    auditTimestamp?: string;
    deterministicSignals: Record<string, boolean>;
    signalEvidence: WebsiteAudit["signalEvidence"];
    screenshotAvailable: boolean;
    screenshotError?: string;
  };
}

export interface QualitativeAnalysisInput {
  context: QualitativeAnalysisContext;
  screenshotDataUrl?: string;
}

function signalValues(audit: WebsiteAudit) {
  return {
    phone: Boolean(audit.phoneFound),
    whatsapp: Boolean(audit.whatsappFound),
    email: Boolean(audit.emailFound),
    booking: Boolean(audit.bookingFound),
    contactForm: Boolean(audit.contactFormFound),
    reviews: Boolean(audit.reviewsIndicators),
    team: Boolean(audit.teamIndicators),
    services: Boolean(audit.servicesIndicators),
    location: Boolean(audit.locationIndicators),
    googleMaps: Boolean(audit.googleMapsFound),
    social: Boolean(audit.socialFound),
  };
}

export async function buildQualitativeAnalysisInput(lead: Lead): Promise<QualitativeAnalysisInput> {
  const audit = lead.audit;
  let screenshotDataUrl: string | undefined;
  let screenshotError = audit.screenshotError;
  if (audit.screenshotUrl) {
    try {
      const stored = await readAuditScreenshot(audit.screenshotUrl);
      if (!stored) throw new Error("Screenshot unavailable");
      const bytes = await new Response(stored.stream).arrayBuffer();
      const contentType = stored.headers.get("content-type") ?? "image/png";
      screenshotDataUrl = `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
    } catch (error) {
      screenshotError = error instanceof Error ? error.message.slice(0, 300) : "Screenshot unavailable";
    }
  }
  return {
    context: {
      business: {
        name: lead.name,
        category: lead.category,
        address: lead.address,
        rating: lead.rating,
        reviewCount: lead.totalRatings,
        phone: lead.phone,
        email: lead.email,
        socialUrl: lead.socialUrl,
      },
      objectiveAudit: {
        objectiveAuditStatus: audit.objectiveAuditStatus ?? audit.status,
        requestedUrl: audit.requestedUrl ?? lead.website,
        finalUrl: audit.finalUrl,
        httpStatus: audit.httpStatus,
        https: audit.https,
        redirectCount: audit.redirectCount,
        pageReachable: audit.pageReachable,
        pageTitle: audit.pageTitle,
        metaDescription: audit.metaDescription,
        h1: audit.h1 ?? [],
        canonical: audit.canonical,
        robotsMeta: audit.robotsMeta,
        mobileViewport: audit.mobileViewport,
        schemaTypes: audit.schemaTypes ?? [],
        language: audit.language,
        performance: audit.performance,
        auditTimestamp: audit.auditTimestamp,
        deterministicSignals: signalValues(audit),
        signalEvidence: audit.signalEvidence ?? {},
        screenshotAvailable: Boolean(screenshotDataUrl),
        screenshotError,
      },
    },
    screenshotDataUrl,
  };
}

export async function analyzeQualitative(
  input: QualitativeAnalysisInput,
  provider: QualitativeProvider = createQualitativeProvider(),
) {
  const raw = await provider.analyze(input);
  return normalizeQualitativeResult(raw, provider.modelVersion, new Date().toISOString());
}
