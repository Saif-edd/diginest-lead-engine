/**
 * Verified Facts Extractor – Sprint 3A
 *
 * Extracts a VerifiedFactsBlock from a Lead using ONLY data that
 * actually exists in the lead and audit records.
 *
 * NEVER invents: doctors, names, credentials, awards, certifications,
 * testimonials, reviews, prices, promotions, patient numbers, services
 * that don't appear in evidence, locations, hours, insurance partners,
 * before/after results.
 */

import type { Lead } from "@/types/lead";
import type { VerifiedFactsBlock, PreviewDepth } from "@/types/preview";

// ---------------------------------------------------------------
// City / Country extraction
// ---------------------------------------------------------------

const KNOWN_CITIES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
  "Al Ain",
  "Riyadh",
  "Jeddah",
  "Muscat",
  "Doha",
  "Manama",
  "Kuwait City",
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "London",
  "Manchester",
  "Birmingham",
  "Dubai Marina",
  "Downtown Dubai",
  "Jumeirah",
];

const COUNTRY_MAP: Record<string, string> = {
  ".ae": "UAE",
  ".sa": "Saudi Arabia",
  ".om": "Oman",
  ".qa": "Qatar",
  ".bh": "Bahrain",
  ".kw": "Kuwait",
  ".ma": "Morocco",
  ".uk": "United Kingdom",
  ".co.uk": "United Kingdom",
};

function extractCity(lead: Lead): string {
  const addr = lead.address ?? "";
  for (const city of KNOWN_CITIES) {
    if (addr.toLowerCase().includes(city.toLowerCase())) return city;
  }
  const first = addr.split(",")[0]?.trim() ?? "";
  return first.length > 2 && first.length < 40 ? first : "";
}

function extractCountry(lead: Lead): string | null {
  const website = lead.website ?? "";
  for (const [tld, country] of Object.entries(COUNTRY_MAP)) {
    if (website.includes(tld)) return country;
  }
  const addr = (lead.address ?? "").toLowerCase();
  if (
    addr.includes("dubai") ||
    addr.includes("abu dhabi") ||
    addr.includes("sharjah") ||
    addr.includes("uae")
  )
    return "UAE";
  if (addr.includes("london") || addr.includes("uk")) return "United Kingdom";
  if (addr.includes("riyadh") || addr.includes("jeddah"))
    return "Saudi Arabia";
  if (addr.includes("casablanca") || addr.includes("rabat") || addr.includes("morocco"))
    return "Morocco";
  return null;
}

// ---------------------------------------------------------------
// Services cleaning
// ---------------------------------------------------------------

function cleanServices(raw: string[]): string[] {
  const cleaned = raw
    .map((e) =>
      e
        .replace(/<[^>]+>/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/^[-\s]+|[-\s]+$/g, "")
        .trim(),
    )
    .filter((e) => e.length > 2 && e.length <= 60);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of cleaned) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      unique.push(s);
      seen.add(key);
    }
  }
  return unique.slice(0, 8);
}

// ---------------------------------------------------------------
// Technical findings from audit
// ---------------------------------------------------------------

function extractTechnicalFindings(lead: Lead): string[] {
  const findings: string[] = [];
  const audit = lead.audit;

  if (audit.pageTitle) {
    findings.push(`Page title: "${audit.pageTitle}"`);
  }
  if (audit.metaDescription) {
    findings.push(`Meta description present: ${audit.metaDescription.length > 80 ? audit.metaDescription.substring(0, 80) + "…" : audit.metaDescription}`);
  } else if (audit.objectiveAuditStatus === "COMPLETE") {
    findings.push("No meta description detected");
  }
  if (audit.mobileViewport === false) {
    findings.push("No mobile viewport meta tag detected");
  }
  if (audit.https === false) {
    findings.push("Site is not HTTPS");
  }
  if (audit.schemaTypes && audit.schemaTypes.length > 0) {
    findings.push(`Schema markup present: ${audit.schemaTypes.join(", ")}`);
  }
  if (audit.language) {
    findings.push(`Page language: ${audit.language}`);
  }
  if (audit.criticalProblems && audit.criticalProblems.length > 0) {
    findings.push(...audit.criticalProblems.map((p) => `CRITICAL: ${p}`));
  }
  if (audit.majorProblems && audit.majorProblems.length > 0) {
    findings.push(...audit.majorProblems.map((p) => `MAJOR: ${p}`));
  }

  return findings;
}

function extractPerformanceEvidence(lead: Lead): string[] {
  const evidence: string[] = [];
  const perf = lead.audit.performance;
  if (!perf) return evidence;

  if (perf.domContentLoadedMs != null) {
    const dcl = perf.domContentLoadedMs;
    if (dcl > 3000) evidence.push(`Slow DOM load: ${dcl}ms`);
    else if (dcl > 1500) evidence.push(`Moderate DOM load: ${dcl}ms`);
    else evidence.push(`Good DOM load: ${dcl}ms`);
  }
  if (perf.loadEventMs != null) {
    const load = perf.loadEventMs;
    if (load > 5000) evidence.push(`Very slow full page load: ${load}ms`);
    else if (load > 3000) evidence.push(`Slow full page load: ${load}ms`);
    else evidence.push(`Full page load: ${load}ms`);
  }
  return evidence;
}

function extractConversionPaths(lead: Lead): string[] {
  const paths: string[] = [];
  const audit = lead.audit;

  if (audit.bookingFound) {
    const url = audit.bookingEvidence?.find((e) => e.startsWith("http"));
    paths.push(url ? `Online booking: ${url}` : "Online booking system detected");
  }
  if (audit.whatsappFound) {
    paths.push("WhatsApp contact available");
  }
  if (audit.phoneFound) {
    const phone = audit.phoneEvidence?.[0] ?? lead.phone;
    if (phone) paths.push(`Phone: ${phone}`);
  }
  if (audit.contactFormFound) {
    paths.push("Contact form detected");
  }
  if (audit.googleMapsFound) {
    paths.push("Google Maps embed found");
  }

  return paths;
}

// ---------------------------------------------------------------
// Social profiles
// ---------------------------------------------------------------

function extractSocialProfiles(lead: Lead): string[] {
  const profiles: string[] = [];

  if (lead.socialUrl) profiles.push(lead.socialUrl);

  const social = lead.audit.socialEvidence ?? [];
  for (const s of social) {
    if (
      s.startsWith("http") &&
      !profiles.includes(s) &&
      profiles.length < 4
    ) {
      profiles.push(s);
    }
  }
  return profiles;
}

// ---------------------------------------------------------------
// Booking URL extraction
// ---------------------------------------------------------------

function extractBookingUrl(lead: Lead): string | null {
  if (!lead.audit.bookingFound) return null;
  const evidence = lead.audit.bookingEvidence ?? [];
  return evidence.find((e) => e.startsWith("http")) ?? null;
}

// ---------------------------------------------------------------
// WhatsApp number
// ---------------------------------------------------------------

function extractWhatsApp(lead: Lead): string | null {
  if (!lead.audit.whatsappFound) return null;
  return lead.audit.whatsappEvidence?.[0] ?? lead.phone ?? null;
}

// ---------------------------------------------------------------
// Main export
// ---------------------------------------------------------------

export function extractVerifiedFacts(lead: Lead): VerifiedFactsBlock {
  const result = lead.audit.qualitativeResult ?? null;
  const city = extractCity(lead);
  const country = extractCountry(lead);

  // Services from audit evidence
  const rawServices = lead.audit.servicesEvidence ?? [];
  const verifiedServices = cleanServices(rawServices);

  // Team info – only if explicitly in evidence, never invented
  const teamEvidence = lead.audit.teamEvidence ?? [];
  const verifiedTeamInfo = teamEvidence
    .filter((e) => e.length > 3 && e.length < 120)
    .slice(0, 4);

  // Location string
  const locationEvidence = lead.audit.locationEvidence ?? [];
  const verifiedLocation =
    locationEvidence.find((e) => e.length > 5) ??
    (city ? `${city}${country ? `, ${country}` : ""}` : null);

  // H1 tags
  const websiteH1 = (lead.audit.h1 ?? []).slice(0, 3);

  // Technical
  const technicalFindings = extractTechnicalFindings(lead);
  const performanceEvidence = extractPerformanceEvidence(lead);
  const detectedConversionPaths = extractConversionPaths(lead);

  // Qualitative
  const mainProblem = lead.audit.mainProblem ?? result?.mainProblem ?? null;
  const secondaryProblems =
    result?.secondaryProblems?.map((p) => `${p.title} [${p.severity}]`) ?? [];
  const qualificationReason = result?.qualificationReason ?? null;
  const outreachAngle = result?.outreachAngle ?? lead.outreachAngle ?? null;
  const recommendedCTA = result?.recommendedCTA ?? null;
  const recommendedHeroAngle = result?.recommendedHeroAngle ?? null;
  const recommendedSections = result?.recommendedSections ?? [];
  const previewDepth: PreviewDepth | null =
    (result?.recommendedPreviewDepth as PreviewDepth | null) ?? null;

  return {
    businessName: lead.name,
    category: lead.category,
    city,
    country,
    currentWebsite: lead.website ?? null,

    googleRating: lead.rating ?? null,
    reviewCount: lead.totalRatings ?? null,

    phone: lead.phone ?? null,
    whatsapp: extractWhatsApp(lead),
    email: lead.email ?? null,
    verifiedBookingUrl: extractBookingUrl(lead),

    verifiedServices,
    verifiedTeamInfo,
    verifiedLocation,
    verifiedSocialProfiles: extractSocialProfiles(lead),

    websiteTitle: lead.audit.pageTitle ?? null,
    websiteMetaDescription: lead.audit.metaDescription ?? null,
    websiteH1,
    technicalFindings,
    performanceEvidence,
    detectedConversionPaths,

    mainProblem,
    secondaryProblems,
    qualificationReason,
    outreachAngle,
    recommendedCTA,
    recommendedHeroAngle,
    recommendedSections,
    previewDepth,
  };
}
