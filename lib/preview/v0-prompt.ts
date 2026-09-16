/**
 * V0 Prompt Pack Generator – Sprint 3A
 *
 * Produces a complete, copy-pasteable V0 prompt for v0.app.
 * Built deterministically from VerifiedFactsBlock + PreviewAssetPack.
 *
 * No external AI. No invented data.
 *
 * Structure:
 *   A. PROJECT
 *   B. VERIFIED BUSINESS FACTS
 *   C. CURRENT WEBSITE PROBLEM
 *   D. REDESIGN OBJECTIVE
 *   E. VISUAL DIRECTION
 *   F. SECTION BLUEPRINT
 *   G. COPY GUIDANCE
 *   H. CTA LOGIC
 *   I. ASSET LIST
 *   J. FACTUAL GUARDRAILS
 *   K. RESPONSIVE REQUIREMENTS
 */

import type { Lead } from "@/types/lead";
import type {
  VerifiedFactsBlock,
  PreviewAssetPack,
  V0PromptPack,
  V0PromptSection,
  V0CopyPack,
  PreviewArchetype,
} from "@/types/preview";
import { selectDentalArchetype } from "./archetype";

// ---------------------------------------------------------------
// Design references (fixed)
// ---------------------------------------------------------------

const DESIGN_REFERENCES = [
  {
    name: "WebDentts",
    url: "https://webdentts.vercel.app/",
    purpose:
      "Primary dental visual benchmark — visual sophistication, premium layout, editorial quality",
  },
  {
    name: "Ktabna",
    url: "https://ktabna.shop/ar",
    purpose:
      "Conversion hierarchy and mobile polish — CTA placement, mobile-first flow, trust signals",
  },
  {
    name: "Breezy Tech",
    url: "https://breezy-tech-hvac-l0luur96y-saifs-projects-afa1e7df.vercel.app/",
    purpose:
      "Local-service CTA clarity and trust structure — direct action, local credibility",
  },
];

// ---------------------------------------------------------------
// Archetype descriptions
// ---------------------------------------------------------------

const ARCHETYPE_DESCRIPTIONS: Record<
  PreviewArchetype,
  { label: string; direction: string }
> = {
  DENTAL_CORE: {
    label: "Clean / Modern / Conversion-Oriented",
    direction:
      "Clean white-dominant layout. Bold headline. Strong CTA above fold. Service cards with icons. Trust strip with rating. Mobile-first hierarchy.",
  },
  DENTAL_PREMIUM: {
    label: "Editorial / Luxurious / Whitespace-Led",
    direction:
      "Rich whitespace. Dark and light contrast sections. Large typography. Imagery-forward. Subtle animations. Premium color palette. Booking as a privileged action.",
  },
  DENTAL_SPECIALIST: {
    label: "Expert-Led / Service-Focused / Authoritative",
    direction:
      "Specialist service grid. Expertise-forward messaging. Clinical trust signals. Clear procedure explanations. Strong secondary CTA for consultations.",
  },
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatRating(facts: VerifiedFactsBlock): string {
  if (facts.googleRating != null && facts.reviewCount != null) {
    return `${facts.googleRating.toFixed(1)} Google rating · ${facts.reviewCount.toLocaleString()} reviews`;
  }
  if (facts.googleRating != null) {
    return `${facts.googleRating.toFixed(1)} Google rating`;
  }
  return "";
}

function formatLocation(facts: VerifiedFactsBlock): string {
  const parts = [facts.city, facts.country].filter(Boolean);
  return parts.join(", ");
}

// ---------------------------------------------------------------
// Section A – PROJECT
// ---------------------------------------------------------------

function buildSectionA(facts: VerifiedFactsBlock, archetype: PreviewArchetype): string {
  const location = formatLocation(facts);
  const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype];

  return `Build a premium dental homepage concept for ${facts.businessName}${location ? ` in ${location}` : ""}.

This is a WEBSITE REDESIGN PREVIEW — not a complete production website.
The goal is to demonstrate what a high-quality redesign could look like for this specific dental practice.

VISUAL ARCHETYPE: ${archetype} — ${archetypeDesc.label}
${archetypeDesc.direction}

PRIMARY DESIGN QUALITY REFERENCES (do not clone — extract their design principles):
${DESIGN_REFERENCES.map((r) => `• ${r.name} (${r.url})\n  Purpose: ${r.purpose}`).join("\n\n")}

Target quality: WebDentts visual sophistication + Ktabna conversion hierarchy + Breezy Tech local-service CTA clarity.

The result should look like a real premium redesign prepared specifically for ${facts.businessName}, not a generic dental template.`;
}

// ---------------------------------------------------------------
// Section B – VERIFIED BUSINESS FACTS
// ---------------------------------------------------------------

function buildSectionB(facts: VerifiedFactsBlock): string {
  const lines: string[] = ["USE ONLY THE FOLLOWING VERIFIED FACTS:"];

  lines.push("");
  lines.push(`Business name: ${facts.businessName}`);
  lines.push(`Category: ${facts.category}`);
  if (facts.city) lines.push(`City: ${facts.city}`);
  if (facts.country) lines.push(`Country: ${facts.country}`);
  if (facts.currentWebsite) lines.push(`Current website: ${facts.currentWebsite}`);

  if (facts.googleRating != null || facts.reviewCount != null) {
    lines.push("");
    lines.push("VERIFIED RATING:");
    lines.push(`  ${formatRating(facts)}`);
    lines.push("  (Use this exact format.)");
  }

  if (facts.phone || facts.whatsapp || facts.email || facts.verifiedBookingUrl) {
    lines.push("");
    lines.push("VERIFIED CONTACT:");
    if (facts.phone) lines.push(`  Phone: ${facts.phone}`);
    if (facts.whatsapp) lines.push(`  WhatsApp: ${facts.whatsapp}`);
    if (facts.email) lines.push(`  Email: ${facts.email}`);
    if (facts.verifiedBookingUrl)
      lines.push(`  Booking URL: ${facts.verifiedBookingUrl}`);
  }

  if (facts.verifiedServices.length > 0) {
    lines.push("");
    lines.push("VERIFIED SERVICES (use only these — do not add or invent more):");
    facts.verifiedServices.forEach((s) => lines.push(`  • ${s}`));
  }

  if (facts.verifiedTeamInfo.length > 0) {
    lines.push("");
    lines.push("VERIFIED TEAM INFO (use only this — do not invent doctor names or credentials):");
    facts.verifiedTeamInfo.forEach((t) => lines.push(`  • ${t}`));
  }

  if (facts.verifiedLocation) {
    lines.push("");
    lines.push(`VERIFIED LOCATION: ${facts.verifiedLocation}`);
  }

  if (facts.verifiedSocialProfiles.length > 0) {
    lines.push("");
    lines.push("VERIFIED SOCIAL PROFILES:");
    facts.verifiedSocialProfiles.forEach((s) => lines.push(`  • ${s}`));
  }

  if (facts.websiteTitle) {
    lines.push("");
    lines.push(`CURRENT PAGE TITLE: ${facts.websiteTitle}`);
  }
  if (facts.websiteH1.length > 0) {
    lines.push(`CURRENT H1: ${facts.websiteH1.join(" | ")}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------
// Section C – CURRENT WEBSITE PROBLEM
// ---------------------------------------------------------------

function buildSectionC(facts: VerifiedFactsBlock): string {
  const lines: string[] = [];

  if (facts.mainProblem) {
    lines.push(`PRIMARY PROBLEM: ${facts.mainProblem}`);
  }

  if (facts.secondaryProblems.length > 0) {
    lines.push("");
    lines.push("SECONDARY PROBLEMS:");
    facts.secondaryProblems.forEach((p) => lines.push(`  • ${p}`));
  }

  if (facts.technicalFindings.length > 0) {
    lines.push("");
    lines.push("TECHNICAL AUDIT FINDINGS:");
    facts.technicalFindings.slice(0, 6).forEach((f) => lines.push(`  • ${f}`));
  }

  if (facts.performanceEvidence.length > 0) {
    lines.push("");
    lines.push("PERFORMANCE EVIDENCE:");
    facts.performanceEvidence.forEach((p) => lines.push(`  • ${p}`));
  }

  if (facts.detectedConversionPaths.length > 0) {
    lines.push("");
    lines.push("CURRENT CONVERSION PATHS DETECTED:");
    facts.detectedConversionPaths.forEach((c) => lines.push(`  • ${c}`));
  }

  if (lines.length === 0) {
    lines.push("Website audit data is limited. Focus on general dental conversion best practices.");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------
// Section D – REDESIGN OBJECTIVE
// ---------------------------------------------------------------

function buildSectionD(facts: VerifiedFactsBlock): string {
  const location = formatLocation(facts);
  const rating = formatRating(facts);

  let objective = `Design a homepage that immediately communicates trust, competence, and ease of booking for ${facts.businessName}${location ? ` in ${location}` : ""}.`;

  if (facts.outreachAngle) {
    objective += `\n\nOUTREACH ANGLE: ${facts.outreachAngle}`;
  }

  if (rating) {
    objective += `\n\nLEVERAGE THE VERIFIED TRUST SIGNAL: ${rating}`;
    objective += `\nThis is the strongest trust asset — make it visible and prominent without fabricating or inflating it.`;
  }

  if (facts.recommendedHeroAngle) {
    objective += `\n\nRECOMMENDED HERO ANGLE: ${facts.recommendedHeroAngle}`;
  }

  if (facts.qualificationReason) {
    objective += `\n\nWHY THIS LEAD WAS QUALIFIED: ${facts.qualificationReason}`;
  }

  return objective;
}

// ---------------------------------------------------------------
// Section E – VISUAL DIRECTION
// ---------------------------------------------------------------

function buildSectionE(
  archetype: PreviewArchetype,
  archetypeReason: string,
): string {
  const desc = ARCHETYPE_DESCRIPTIONS[archetype];

  return `RECOMMENDED ARCHETYPE: ${archetype}
REASON: ${archetypeReason}

VISUAL DIRECTION:
${desc.direction}

DESIGN PRINCIPLES FROM REFERENCES:
• From WebDentts: Premium editorial quality, whitespace discipline, refined typography scale
• From Ktabna: Mobile-first hierarchy, prominent CTA, trust-strip placement, conversion flow
• From Breezy Tech: Clear local-service identity, direct primary action, approachable trust signals

DO NOT clone any of these sites. Use their design quality as the target bar.

COLOR APPROACH:
• For DENTAL_CORE: Clean whites, one strong accent (teal/navy), professional sans-serif
• For DENTAL_PREMIUM: Dark navy or deep charcoal + warm off-white, gold or rose accent, elevated typography
• For DENTAL_SPECIALIST: Clinical white + strong professional blue or emerald, bold service-focused layout`;
}

// ---------------------------------------------------------------
// Section F – SECTION BLUEPRINT
// ---------------------------------------------------------------

function buildSectionBlueprint(facts: VerifiedFactsBlock): string[] {
  const blueprint: string[] = [];

  // Always include these
  blueprint.push("Top utility bar (phone number + WhatsApp if available)");
  blueprint.push("Navigation (logo, services dropdown, contact, book button)");
  blueprint.push(`Hero section (headline: ${facts.recommendedHeroAngle ?? "Modern dental care in " + facts.city})`);

  // Trust strip – only if rating evidence
  if (facts.googleRating != null) {
    blueprint.push(`Trust/reputation strip (${formatRating(facts)} — exact format)`);
  }

  // Services – only if verified
  if (facts.verifiedServices.length > 0) {
    blueprint.push(
      `Services grid (verified services only: ${facts.verifiedServices.slice(0, 4).join(", ")}${facts.verifiedServices.length > 4 ? "…" : ""})`,
    );
  }

  // Team – only if verified evidence
  if (facts.verifiedTeamInfo.length > 0) {
    blueprint.push(
      "Doctor/team section (only from verified team info provided — do not invent names or credentials)",
    );
  }

  // About / clinic
  blueprint.push("Clinic/about section (location, founding story if verifiable — no invented history)");

  // Why choose – only from factual evidence
  if (facts.googleRating != null && facts.reviewCount != null) {
    blueprint.push("Why choose section (built only from verified rating, reviews, and available services)");
  }

  // Reviews metrics – only if we have the data
  if (facts.googleRating != null) {
    blueprint.push(
      `Reviews metrics strip (${formatRating(facts)} — no testimonial quotes unless verified)`,
    );
  }

  // Location / contact – only if we have location data
  if (facts.verifiedLocation || facts.detectedConversionPaths.length > 0) {
    blueprint.push(
      `Location/contact section${facts.verifiedLocation ? ` (${facts.verifiedLocation})` : ""}`,
    );
  }

  // Booking CTA
  if (facts.verifiedBookingUrl) {
    blueprint.push(`Booking CTA (verified booking: ${facts.verifiedBookingUrl})`);
  } else if (facts.whatsapp || facts.phone) {
    blueprint.push(
      `Primary CTA: ${facts.whatsapp ? "WhatsApp" : "Call"} — ${facts.whatsapp ?? facts.phone}`,
    );
  }

  // Final CTA
  blueprint.push("Final CTA section (repeat primary action, reinforce trust signal)");
  blueprint.push("Footer (contact, social if verified, services, location)");

  return blueprint;
}

function buildSectionF(facts: VerifiedFactsBlock): string {
  const blueprint = buildSectionBlueprint(facts);
  return (
    "BUILD THESE SECTIONS IN ORDER (do not add sections unsupported by evidence):\n\n" +
    blueprint.map((s, i) => `${i + 1}. ${s}`).join("\n")
  );
}

// ---------------------------------------------------------------
// Section G – COPY GUIDANCE
// ---------------------------------------------------------------

function buildCopyPack(facts: VerifiedFactsBlock): V0CopyPack {
  const city = facts.city || "your city";
  const name = facts.businessName;
  const rating = formatRating(facts);
  const heroAngle = facts.recommendedHeroAngle ?? `Modern dental care in ${city}`;

  // Headline
  const headline = heroAngle;

  // Subheadline – based on available evidence
  let subheadline: string;
  if (rating) {
    subheadline = `${rating} — serving patients across ${city}.`;
  } else {
    subheadline = `Quality dental care for you and your family in ${city}.`;
  }

  // CTAs
  let primaryCTA = "Book an Appointment";
  let secondaryCTA = "Call Us";
  if (facts.recommendedCTA) {
    primaryCTA = facts.recommendedCTA;
  } else if (facts.verifiedBookingUrl) {
    primaryCTA = "Book Online";
  } else if (facts.whatsapp) {
    primaryCTA = "WhatsApp Us";
    secondaryCTA = facts.phone ? "Call the Clinic" : "Contact Us";
  } else if (facts.phone) {
    primaryCTA = "Call the Clinic";
    secondaryCTA = "Contact Us";
  }

  // Trust copy
  const trustCopy = rating
    ? rating
    : `Trusted dental care in ${city}`;

  // Service titles – from verified evidence only
  const serviceTitles = facts.verifiedServices.slice(0, 6);

  // Section headings
  const sectionHeadings: Record<string, string> = {
    services: facts.verifiedServices.length > 0
      ? `Our Dental Services`
      : `Comprehensive Dental Care`,
    about: `About ${name}`,
    contact: `Book Your Visit`,
    location: `Find Us in ${city}`,
    reviews: rating ? `Rated ${rating}` : `Patient Trust`,
    footer: `${name}`,
  };

  // Location CTA
  const locationCTA = facts.verifiedLocation
    ? `Visit us at ${facts.verifiedLocation}`
    : city
    ? `Located in ${city}`
    : `Contact us for our location`;

  // Final CTA
  const finalCTA = facts.verifiedBookingUrl
    ? `Ready to book? Schedule your appointment online.`
    : facts.whatsapp
    ? `Ready to visit? WhatsApp us now.`
    : facts.phone
    ? `Ready to visit? Call us today.`
    : `Contact ${name} to schedule your appointment.`;

  return {
    headline,
    subheadline,
    primaryCTA,
    secondaryCTA,
    trustCopy,
    serviceTitles,
    sectionHeadings,
    locationCTA,
    finalCTA,
  };
}

function buildSectionG(copy: V0CopyPack): string {
  const lines = [
    "USE THIS COPY GUIDANCE (adapt for design flow, do not invent new claims):",
    "",
    `HEADLINE: "${copy.headline}"`,
    `SUBHEADLINE: "${copy.subheadline}"`,
    `PRIMARY CTA: "${copy.primaryCTA}"`,
    `SECONDARY CTA: "${copy.secondaryCTA}"`,
    `TRUST COPY: "${copy.trustCopy}"`,
  ];

  if (copy.serviceTitles.length > 0) {
    lines.push("");
    lines.push("SERVICE TITLES (verified only):");
    copy.serviceTitles.forEach((s) => lines.push(`  • ${s}`));
  }

  lines.push("");
  lines.push("SECTION HEADINGS:");
  Object.entries(copy.sectionHeadings).forEach(([key, value]) =>
    lines.push(`  ${key}: "${value}"`),
  );

  lines.push("");
  lines.push(`LOCATION CTA: "${copy.locationCTA}"`);
  lines.push(`FINAL CTA: "${copy.finalCTA}"`);

  return lines.join("\n");
}

// ---------------------------------------------------------------
// Section H – CTA LOGIC
// ---------------------------------------------------------------

function buildSectionH(facts: VerifiedFactsBlock): string {
  const lines = [
    "CTA PRIORITY ORDER (use highest-priority verified channel available):",
    "",
  ];

  if (facts.verifiedBookingUrl) {
    lines.push(
      `1. PRIMARY: Online Booking — ${facts.verifiedBookingUrl} (VERIFIED)`,
    );
  }
  if (facts.whatsapp) {
    lines.push(
      `${facts.verifiedBookingUrl ? "2" : "1"}. WHATSAPP: ${facts.whatsapp} (VERIFIED) — link: https://wa.me/${facts.whatsapp.replace(/\D/g, "")}`,
    );
  }
  if (facts.phone) {
    const rank = [facts.verifiedBookingUrl, facts.whatsapp].filter(Boolean).length + 1;
    lines.push(`${rank}. PHONE: ${facts.phone} (VERIFIED) — link: tel:${facts.phone}`);
  }
  if (facts.email) {
    const rank = [facts.verifiedBookingUrl, facts.whatsapp, facts.phone].filter(Boolean).length + 1;
    lines.push(`${rank}. EMAIL: ${facts.email}`);
  }

  if (
    !facts.verifiedBookingUrl &&
    !facts.whatsapp &&
    !facts.phone &&
    !facts.email
  ) {
    lines.push("No verified contact channel available — use a generic 'Contact Us' placeholder.");
  }

  lines.push("");
  lines.push("CTA RULES:");
  lines.push("• Make the primary CTA visible above the fold on mobile");
  lines.push("• Repeat the primary CTA at the bottom of every major section");
  lines.push("• The sticky mobile footer should show the primary CTA only");
  lines.push("• Do not create fake booking links if no booking URL is provided");

  return lines.join("\n");
}

// ---------------------------------------------------------------
// Section I – ASSET LIST
// ---------------------------------------------------------------

function buildSectionI(assetPack: PreviewAssetPack): string {
  const lines = ["ASSETS PROVIDED (use available assets, never fabricate):"];
  lines.push("");

  if (assetPack.currentWebsiteScreenshotUrl) {
    lines.push(
      `• Current website screenshot: ${assetPack.currentWebsiteScreenshotUrl.url} (confidence: ${assetPack.currentWebsiteScreenshotUrl.confidence})`,
    );
    lines.push("  → Use this as reference for what NOT to copy, and to understand the brand");
  }

  if (assetPack.logoUrl) {
    lines.push(
      `• Logo: ${assetPack.logoUrl.url} (confidence: ${assetPack.logoUrl.confidence})`,
    );
  } else {
    lines.push(
      "• Logo: NOT PROVIDED — use a text logo / wordmark placeholder with the business name",
    );
  }

  if (assetPack.ogImageUrl) {
    lines.push(
      `• OG/social image: ${assetPack.ogImageUrl.url} (confidence: ${assetPack.ogImageUrl.confidence})`,
    );
  }

  if (assetPack.faviconUrl) {
    lines.push(
      `• Favicon: ${assetPack.faviconUrl.url} (confidence: ${assetPack.faviconUrl.confidence})`,
    );
  }

  if (assetPack.heroImageCandidates.length > 0) {
    lines.push("");
    lines.push("HERO IMAGE CANDIDATES (in priority order):");
    assetPack.heroImageCandidates.slice(0, 3).forEach((a, i) => {
      lines.push(`  ${i + 1}. ${a.url} [${a.type}, ${a.confidence}]`);
    });
  } else {
    lines.push("");
    lines.push(
      "• No verified hero image available — use a high-quality dental stock image or gradient background",
    );
    lines.push(
      "  (Do not use real patient images. Use professional clinical or modern dental practice imagery.)",
    );
  }

  lines.push("");
  lines.push(
    `Source website: ${assetPack.sourceWebsite ?? "Not available"}`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------
// Section J – FACTUAL GUARDRAILS
// ---------------------------------------------------------------

function buildSectionJ(facts: VerifiedFactsBlock): string {
  const ratingStr = formatRating(facts);

  return `FACTUAL RESTRICTIONS — STRICTLY ENFORCED:

DO NOT invent or fabricate any of the following:
• Doctor names or credentials (only use verified team info if provided above)
• Years of experience or "founded in [year]" unless verified
• Awards or certifications not in the verified facts
• Testimonials or patient quotes (no fabricated reviews)
• Review text or patient stories
• Prices or promotional offers
• "Satisfied patients" figures (use only the verified rating format)
• Services not listed in the verified services block
• Opening hours (not verified — do not show any)
• Insurance partners (not verified)
• Before/after results or success rates
• "State-of-the-art equipment" unless specifically verified
• Team size claims

RATING FORMAT RULES:
${ratingStr ? `• CORRECT: "${ratingStr}"` : "• No rating verified — do not show any rating"}
${ratingStr ? `• INCORRECT: "verified reviews", "satisfied patients", fabricated count` : ""}
• Do not add stars beyond what the rating number states

COPY RESTRICTIONS:
• Only use service names from the verified services list
• Only use contact details from the verified contact block
• The business name is: "${facts.businessName}" — use this exact name
• City is: "${facts.city || "unknown"}" — use only if verified`;
}

// ---------------------------------------------------------------
// Section K – RESPONSIVE REQUIREMENTS
// ---------------------------------------------------------------

const SECTION_K = `MOBILE-FIRST RESPONSIVE DESIGN:

Design intentionally for 375px mobile width as well as desktop (1280px+).

MOBILE PRIORITIES:
• Hero: Full-viewport, headline visible without scrolling
• CTA button: Minimum 48px tall, full-width on mobile
• Sticky bottom bar on mobile: Primary CTA button only
• Navigation: Hamburger menu, clean close animation
• Service cards: Single column on mobile, 2–3 on desktop
• Trust strip: Horizontal scroll or stacked on mobile
• Typography: Minimum 16px base on mobile
• Tap targets: All interactive elements ≥ 44px

DESKTOP ENHANCEMENTS:
• Two-column hero (text left, image right)
• Service grid 3–4 columns
• Navigation: Full horizontal with CTA button
• Side-by-side contact + map layout if location verified`;

// ---------------------------------------------------------------
// Main export
// ---------------------------------------------------------------

export function generateV0PromptPack(
  lead: Lead,
  facts: VerifiedFactsBlock,
  assetPack: PreviewAssetPack,
): V0PromptPack {
  const result = lead.audit.qualitativeResult ?? null;
  const { archetype } = result
    ? selectDentalArchetype(lead, result)
    : { archetype: "DENTAL_CORE" as PreviewArchetype };

  const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype];
  const archetypeReason = result
    ? `Based on${result.recommendedPreviewDepth === "PREMIUM" ? " PREMIUM depth recommendation" : ""}${lead.rating && lead.rating >= 4.7 && (lead.totalRatings ?? 0) >= 200 ? " high trust signal (rating + reviews)" : ""}${
        facts.verifiedServices.some((s) =>
          /orthodont|implant|cosmetic|specialist/i.test(s),
        )
          ? " specialist service evidence"
          : ""
      } — defaulting to ${archetype}`
    : `Defaulted to ${archetype} (no qualitative analysis available)`;

  const sectionBlueprint = buildSectionBlueprint(facts);
  const copyPack = buildCopyPack(facts);

  // Build individual sections
  const sections: V0PromptSection[] = [
    { key: "A", label: "PROJECT", content: buildSectionA(facts, archetype) },
    { key: "B", label: "VERIFIED BUSINESS FACTS", content: buildSectionB(facts) },
    { key: "C", label: "CURRENT WEBSITE PROBLEM", content: buildSectionC(facts) },
    { key: "D", label: "REDESIGN OBJECTIVE", content: buildSectionD(facts) },
    {
      key: "E",
      label: "VISUAL DIRECTION",
      content: buildSectionE(archetype, archetypeReason),
    },
    { key: "F", label: "SECTION BLUEPRINT", content: buildSectionF(facts) },
    { key: "G", label: "COPY GUIDANCE", content: buildSectionG(copyPack) },
    { key: "H", label: "CTA LOGIC", content: buildSectionH(facts) },
    { key: "I", label: "ASSET LIST", content: buildSectionI(assetPack) },
    { key: "J", label: "FACTUAL GUARDRAILS", content: buildSectionJ(facts) },
    { key: "K", label: "RESPONSIVE REQUIREMENTS", content: SECTION_K },
  ];

  // Assemble master prompt
  const masterPrompt = sections
    .map(
      (s) =>
        `${"=".repeat(60)}\n${s.key}. ${s.label}\n${"=".repeat(60)}\n\n${s.content}`,
    )
    .join("\n\n");

  return {
    masterPrompt,
    sections,
    copyPack,
    archetype,
    archetypeReason,
    designReferences: DESIGN_REFERENCES,
    sectionBlueprint,
    generatedAt: new Date().toISOString(),
  };
}
