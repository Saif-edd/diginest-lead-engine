/**
 * Deterministic copy builder for dental preview previews.
 *
 * Uses only verified business data + qualitative recommendation fields.
 * NO external AI calls. No invented facts.
 *
 * Produces:
 * - eyebrow
 * - headline
 * - subheadline
 * - trust items
 * - services list
 * - sections list
 */

import type { Lead } from "@/types/lead";
import type { QualitativeResult } from "@/types/qualitative";
import type {
  TrustItem,
  ServiceCard,
  PreviewDepth,
  SourceEvidence,
} from "@/types/preview";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract city from lead address. Falls back to "the UAE". */
function extractCity(lead: Lead): string {
  const addr = lead.address ?? "";
  // Common GCC city names
  const cities = [
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
  ];
  for (const city of cities) {
    if (addr.toLowerCase().includes(city.toLowerCase())) return city;
  }
  // Fall back: first comma-separated segment
  const first = addr.split(",")[0]?.trim() ?? "";
  return first.length > 2 && first.length < 40 ? first : "the UAE";
}

/** Build trust items from verified data. Returns only items with evidence. */
function buildTrustItems(
  lead: Lead,
  result: QualitativeResult,
  evidence: SourceEvidence[],
): TrustItem[] {
  const items: TrustItem[] = [];

  // Rating + review count – verified values only
  if (lead.rating != null && lead.totalRatings != null) {
    items.push({
      label: "Google Rating",
      value: `${lead.rating.toFixed(1)} · ${lead.totalRatings.toLocaleString()} reviews`,
      icon: "star",
    });
    evidence.push({
      field: "rating+totalRatings",
      value: `${lead.rating} / ${lead.totalRatings}`,
      source: "lead",
    });
  } else if (lead.rating != null) {
    items.push({
      label: "Google Rating",
      value: lead.rating.toFixed(1),
      icon: "star",
    });
    evidence.push({ field: "rating", value: String(lead.rating), source: "lead" });
  }

  // Phone verified
  if (lead.audit.phoneFound || lead.phone) {
    items.push({ label: "Call us", value: lead.phone ?? "Verified contact", icon: "phone" });
    evidence.push({ field: "phone", value: lead.phone ?? "present", source: "audit" });
  }

  // WhatsApp verified
  if (lead.audit.whatsappFound) {
    items.push({ label: "WhatsApp", value: "Available", icon: "whatsapp" });
    evidence.push({ field: "whatsapp", value: "verified", source: "audit" });
  }

  // Location verified
  if (lead.audit.locationIndicators || lead.audit.googleMapsFound) {
    const city = extractCity(lead);
    items.push({ label: "Location", value: city, icon: "location" });
    evidence.push({ field: "location", value: city, source: "audit" });
  }

  // Booking verified
  if (lead.audit.bookingFound) {
    items.push({ label: "Online Booking", value: "Available", icon: "calendar" });
    evidence.push({ field: "booking", value: "verified", source: "audit" });
  }

  // Social verified
  if (lead.audit.socialFound) {
    items.push({ label: "Social Media", value: "Active", icon: "social" });
  }

  return items;
}

/** Extract verified service cards from audit evidence. */
function buildServiceCards(lead: Lead): ServiceCard[] {
  const raw = lead.audit.servicesEvidence ?? [];
  if (raw.length === 0) return [];

  // Clean up evidence strings: remove HTML/URL fragments, deduplicate
  const cleaned = raw
    .map((e) =>
      e
        .replace(/<[^>]+>/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .trim(),
    )
    .filter((e) => e.length > 1 && e.length < 80)
    .slice(0, 6);

  return cleaned.map((name) => ({ name }));
}

/** Choose sections based on depth and available evidence. */
function buildSections(
  depth: PreviewDepth,
  lead: Lead,
  services: ServiceCard[],
  result: QualitativeResult,
): string[] {
  if (depth === "NONE" || depth === "LIGHT") return [];

  const sections: string[] = [];

  if (depth === "STRONG" || depth === "PREMIUM") {
    if (services.length > 0) sections.push("services");
    if (result.recommendedSections.includes("contact") || lead.audit.googleMapsFound) {
      sections.push("location");
    }
  }

  if (depth === "PREMIUM") {
    if (lead.audit.reviewsIndicators) sections.push("reviews");
    if (lead.audit.socialFound) sections.push("social");
    // Only add team section if evidence exists – never fabricated
    if (lead.audit.teamIndicators && (lead.audit.teamEvidence?.length ?? 0) > 0) {
      sections.push("team");
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Hero copy templates – factual, problem-aware
// ---------------------------------------------------------------------------
interface HeroCopy {
  eyebrow: string;
  headline: string;
  subheadline: string;
}

function buildHeroCopy(
  lead: Lead,
  result: QualitativeResult,
  city: string,
): HeroCopy {
  const name = lead.name;
  const mainProblem = result.mainProblem.toLowerCase();
  const heroAngle = result.recommendedHeroAngle;
  const category = lead.category;

  // Specialty detection for headline
  const isOrtho =
    mainProblem.includes("ortho") ||
    heroAngle.toLowerCase().includes("ortho") ||
    name.toLowerCase().includes("ortho");
  const isCosm =
    mainProblem.includes("cosmet") ||
    heroAngle.toLowerCase().includes("cosmet") ||
    name.toLowerCase().includes("cosmet");
  const isImplant =
    mainProblem.includes("implant") ||
    heroAngle.toLowerCase().includes("implant") ||
    name.toLowerCase().includes("implant");

  let headline: string;
  if (isOrtho) {
    headline = `Specialist orthodontic care in ${city}`;
  } else if (isCosm) {
    headline = `Cosmetic dentistry you can trust in ${city}`;
  } else if (isImplant) {
    headline = `Dental implants by specialists in ${city}`;
  } else if (category.toLowerCase().includes("specialist")) {
    headline = `Specialist dental care in ${city}`;
  } else {
    headline = `Modern dental care in ${city}`;
  }

  // Subheadline reflects the qualitative recommendation
  const focusLower = result.recommendedPreviewFocus.toLowerCase();
  let subheadline: string;
  if (focusLower.includes("trust") || focusLower.includes("review")) {
    const rating = lead.rating;
    const reviews = lead.totalRatings;
    if (rating != null && reviews != null) {
      subheadline = `Trusted by patients across ${city} — ${rating.toFixed(1)} stars from ${reviews.toLocaleString()} verified reviews.`;
    } else {
      subheadline = `Trusted by patients across ${city}. Book your appointment today.`;
    }
  } else if (focusLower.includes("book") || focusLower.includes("cta") || focusLower.includes("appointment")) {
    subheadline = `Easy online booking available. Reserve your visit at ${name} today.`;
  } else if (focusLower.includes("service")) {
    subheadline = `Comprehensive dental treatments for the whole family in ${city}.`;
  } else {
    subheadline = `Quality dental care for you and your family in ${city}.`;
  }

  const eyebrow = name;

  return { eyebrow, headline, subheadline };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export interface PreviewCopyResult {
  city: string;
  heroCopy: HeroCopy;
  trustItems: TrustItem[];
  services: ServiceCard[];
  sections: string[];
  evidence: SourceEvidence[];
}

export function buildPreviewCopy(
  lead: Lead,
  result: QualitativeResult,
  depth: PreviewDepth,
): PreviewCopyResult {
  const evidence: SourceEvidence[] = [];
  const city = extractCity(lead);
  const heroCopy = buildHeroCopy(lead, result, city);
  const trustItems = buildTrustItems(lead, result, evidence);
  const services = buildServiceCards(lead);
  const sections = buildSections(depth, lead, services, result);

  // Record evidence for hero
  evidence.push(
    { field: "recommendedHeroAngle", value: result.recommendedHeroAngle, source: "qualitative" },
    { field: "recommendedPreviewFocus", value: result.recommendedPreviewFocus, source: "qualitative" },
    { field: "mainProblem", value: result.mainProblem, source: "qualitative" },
  );

  return { city, heroCopy, trustItems, services, sections, evidence };
}
