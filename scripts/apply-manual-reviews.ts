/**
 * Sprint 2B Manual Review Application Script
 *
 * Calls production APIs to apply human-reviewed qualitative calibration
 * decisions for the 5 leads approved during Sprint 2B.
 *
 * Usage: tsx scripts/apply-manual-reviews.ts
 * (reads DIGINEST_ADMIN_TOKEN and DIGINEST_PRODUCTION_URL from env)
 *
 * DO NOT re-run Gemini for these leads.
 */

const BASE_URL = (process.env.DIGINEST_PRODUCTION_URL ?? "https://diginest-lead-engine.vercel.app").replace(/\/$/, "");
const TOKEN = process.env.DIGINEST_ADMIN_TOKEN;
if (!TOKEN) throw new Error("DIGINEST_ADMIN_TOKEN not set");

const NOW = new Date().toISOString();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dim(score: number, max: number, sev: "CRITICAL" | "MAJOR" | "MINOR" | "NONE", reason: string) {
  return { score, maxScore: max, severity: sev, reason, evidenceUsed: [{ source: "audit" as const, field: "objectiveAudit", detail: "Manual review – Sprint 2B calibration" }], confidence: "HIGH" as const };
}
function gate(critical: number, major: number, reason: string) {
  return { passes: critical >= 1 || major >= 2, criticalCount: critical, majorCount: major, reason };
}
async function apiFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ─── Sprint 2B calibration decisions ─────────────────────────────────────────

const REVIEWS = [
  {
    leadId: "lead-20260915-0001",
    name: "Vision Dental Clinic Abu Dhabi",
    result: {
      schemaVersion: "sprint-2b.v1" as const,
      modelVersion: "manual-review-sprint-2b",
      analyzedAt: NOW,
      qualificationDecisionSource: "MANUAL_REVIEW" as const,
      qualificationDecision: "QUALIFY" as const,
      qualificationReason: "Strong trust signals (4.9/1070 reviews), verified booking. Outdated visual hierarchy and hidden reviews represent a clear transformation opportunity.",
      mainProblem: "Outdated visual hierarchy hides strong trust signals – reviews not prominent above fold, CTA buried",
      mainProblemSeverity: "MAJOR" as const,
      secondaryProblems: [{ title: "Trust signals below fold", severity: "MAJOR" as const, evidence: "4.9/1070 reviews not visible in hero section" }],
      dimensions: {
        mobileResponsive: dim(3, 6, "MAJOR", "Mobile layout functional but hero not optimised for conversion"),
        heroMessageClarity: dim(2, 5, "CRITICAL", "Hero headline generic; clinic value prop not immediately clear"),
        ctaContactBooking: dim(4, 8, "MAJOR", "Booking found but buried; not prominent in hero"),
        visualTrustDesign: dim(2, 6, "MAJOR", "Design dated; trust/review signals not surfaced above fold"),
        servicesNavigation: dim(3, 4, "MINOR", "Services page exists and is navigable"),
        speedPerformance: dim(3, 4, "NONE", "Site loads acceptably"),
        reviewsTeamTrust: dim(1, 3, "MAJOR", "1070 Google reviews not displayed on site"),
        localSeoTechnical: dim(3, 4, "NONE", "Canonical and meta present"),
      },
      websiteOpportunityScore: 21,
      opportunityGate: gate(1, 3, "1 critical + 3 major"),
      commercialProfileScore: 9,
      commercialProfile: { score: 9, maxScore: 10, evidenceUsed: [{ source: "lead" as const, field: "rating+totalRatings", detail: "4.9/1070" }], confidence: "HIGH" as const },
      previewPotential: { realInformationAssets: 9, clearServiceAngle: 8, transformationOpportunity: 9, personalizedCtaPotential: 8, total: 34, reviewed: true as const, evidenceUsed: [{ source: "audit" as const, field: "servicesEvidence", detail: "Dental Implants, Orthodontics verified" }], confidence: "HIGH" as const },
      recommendedPreviewDepth: "STRONG" as const,
      recommendedPreviewFocus: "Surface 4.9-star / 1070-review trust above fold; modernise visual hierarchy",
      recommendedCTA: "Book an Appointment",
      recommendedHeroAngle: "Abu Dhabi's highest-rated dental clinic – trusted by 1,000+ patients",
      recommendedSections: ["services", "reviews", "booking", "location"],
      outreachAngle: "Your 4.9-star reputation is invisible on your website – your preview shows what it could look like",
    },
  },
  {
    leadId: "lead-20260915-0002",
    name: "International Center for Dental Excellence (ICDE)",
    result: {
      schemaVersion: "sprint-2b.v1" as const,
      modelVersion: "manual-review-sprint-2b",
      analyzedAt: NOW,
      qualificationDecisionSource: "MANUAL_REVIEW" as const,
      qualificationDecision: "QUALIFY" as const,
      qualificationReason: "Multi-specialist clinic with exceptional Google reviews. First-screen underdelivers vs brand quality – strong PREMIUM preview opportunity.",
      mainProblem: "Cluttered first screen fails to communicate clinic quality; trust signals and specialist credentials buried",
      mainProblemSeverity: "CRITICAL" as const,
      secondaryProblems: [
        { title: "Trust signals below fold", severity: "MAJOR" as const, evidence: "Review volume and specialist credentials not prominent in hero" },
        { title: "CTA hierarchy unclear", severity: "MAJOR" as const, evidence: "Booking path present but not hero-level prominent" },
      ],
      dimensions: {
        mobileResponsive: dim(3, 6, "MAJOR", "Mobile layout adequate but not conversion-optimised"),
        heroMessageClarity: dim(1, 5, "CRITICAL", "Hero message generic; specialist positioning not clear at a glance"),
        ctaContactBooking: dim(4, 8, "MAJOR", "Booking available but not prominently positioned"),
        visualTrustDesign: dim(2, 6, "MAJOR", "Visual presentation underdelivers relative to clinic quality"),
        servicesNavigation: dim(3, 4, "MINOR", "Services navigable"),
        speedPerformance: dim(3, 4, "NONE", "Performance adequate"),
        reviewsTeamTrust: dim(1, 3, "MAJOR", "Exceptional reviews not leveraged in hero or trust strip"),
        localSeoTechnical: dim(3, 4, "NONE", "Technical basics present"),
      },
      websiteOpportunityScore: 20,
      opportunityGate: gate(1, 3, "1 critical + 3 major"),
      commercialProfileScore: 9,
      commercialProfile: { score: 9, maxScore: 10, evidenceUsed: [{ source: "lead" as const, field: "rating+totalRatings", detail: "4.8/verified" }], confidence: "HIGH" as const },
      previewPotential: { realInformationAssets: 9, clearServiceAngle: 9, transformationOpportunity: 10, personalizedCtaPotential: 9, total: 37, reviewed: true as const, evidenceUsed: [{ source: "audit" as const, field: "reviewsEvidence", detail: "Named doctors and patient quotes verified" }], confidence: "HIGH" as const },
      recommendedPreviewDepth: "PREMIUM" as const,
      recommendedPreviewFocus: "Cleaner first-screen experience; prominent trust/reviews; specialist positioning",
      recommendedCTA: "Book an Appointment",
      recommendedHeroAngle: "Abu Dhabi's centre of dental excellence – specialists in implants, orthodontics & cosmetic dentistry",
      recommendedSections: ["services", "reviews", "team", "location", "booking"],
      outreachAngle: "Your clinic has exceptional reviews – your website doesn't show it. Here's your preview.",
    },
  },
  {
    leadId: "lead-20260915-0032",
    name: "Harley Street Dental Center",
    result: {
      schemaVersion: "sprint-2b.v1" as const,
      modelVersion: "manual-review-sprint-2b",
      analyzedAt: NOW,
      qualificationDecisionSource: "MANUAL_REVIEW" as const,
      qualificationDecision: "QUALIFY" as const,
      qualificationReason: "Multi-specialist team verified, booking present, strong rating. Hero/CTA hierarchy is the primary gap.",
      mainProblem: "Hero section doesn't establish authority or direct to booking – strong clinical team buried below fold",
      mainProblemSeverity: "MAJOR" as const,
      secondaryProblems: [{ title: "Team credentials buried", severity: "MAJOR" as const, evidence: "Specialist team (10+ named doctors) not surfaced above fold" }],
      dimensions: {
        mobileResponsive: dim(4, 6, "MINOR", "Mobile responsive with some layout issues"),
        heroMessageClarity: dim(2, 5, "CRITICAL", "Hero does not establish specialist authority"),
        ctaContactBooking: dim(5, 8, "MAJOR", "Booking page exists but hero CTA not prominent"),
        visualTrustDesign: dim(3, 6, "MAJOR", "Design adequate but below premium positioning expected"),
        servicesNavigation: dim(3, 4, "NONE", "Services well-structured"),
        speedPerformance: dim(3, 4, "NONE", "Adequate"),
        reviewsTeamTrust: dim(1, 3, "MAJOR", "Team of 10+ specialists not highlighted"),
        localSeoTechnical: dim(3, 4, "NONE", "Technical basics present"),
      },
      websiteOpportunityScore: 24,
      opportunityGate: gate(1, 2, "1 critical + 2 major"),
      commercialProfileScore: 8,
      commercialProfile: { score: 8, maxScore: 10, evidenceUsed: [{ source: "lead" as const, field: "rating+totalRatings", detail: "4.6/486" }], confidence: "HIGH" as const },
      previewPotential: { realInformationAssets: 8, clearServiceAngle: 8, transformationOpportunity: 8, personalizedCtaPotential: 8, total: 32, reviewed: true as const, evidenceUsed: [{ source: "audit" as const, field: "servicesEvidence", detail: "Multi-specialist verified" }], confidence: "HIGH" as const },
      recommendedPreviewDepth: "STRONG" as const,
      recommendedPreviewFocus: "Surface specialist team authority and direct booking CTA in hero",
      recommendedCTA: "Book an Appointment",
      recommendedHeroAngle: "Abu Dhabi specialist dental centre – from cosmetic dentistry to oral surgery",
      recommendedSections: ["services", "booking", "location"],
      outreachAngle: "Your specialist team is one of Abu Dhabi's strongest – your homepage doesn't show it.",
    },
  },
  {
    leadId: "lead-20260915-0043",
    name: "Paramount Clinics",
    result: {
      schemaVersion: "sprint-2b.v1" as const,
      modelVersion: "manual-review-sprint-2b",
      analyzedAt: NOW,
      qualificationDecisionSource: "MANUAL_REVIEW" as const,
      qualificationDecision: "QUALIFY" as const,
      qualificationReason: "Strong rating and review count. Mobile CTA / booking is the primary gap – phone-only weakens conversion.",
      mainProblem: "No online booking; mobile CTA relies solely on phone – high conversion friction",
      mainProblemSeverity: "CRITICAL" as const,
      secondaryProblems: [{ title: "No WhatsApp or booking widget", severity: "MAJOR" as const, evidence: "bookingFound: false, whatsappFound: false" }],
      dimensions: {
        mobileResponsive: dim(3, 6, "MAJOR", "Mobile layout present but no mobile-optimised booking/CTA"),
        heroMessageClarity: dim(2, 5, "MAJOR", "Multi-service positioning dilutes dental focus"),
        ctaContactBooking: dim(2, 8, "CRITICAL", "Phone-only CTA; no booking or WhatsApp"),
        visualTrustDesign: dim(3, 6, "MINOR", "Visual design adequate"),
        servicesNavigation: dim(3, 4, "NONE", "Services well-structured"),
        speedPerformance: dim(3, 4, "NONE", "Adequate"),
        reviewsTeamTrust: dim(2, 3, "MINOR", "Reviews visible but not prominently featured"),
        localSeoTechnical: dim(2, 4, "MINOR", "HTTP site, potential SEO gap"),
      },
      websiteOpportunityScore: 20,
      opportunityGate: gate(1, 1, "1 critical – phone-only CTA"),
      commercialProfileScore: 8,
      commercialProfile: { score: 8, maxScore: 10, evidenceUsed: [{ source: "lead" as const, field: "rating+totalRatings", detail: "4.8/277" }], confidence: "HIGH" as const },
      previewPotential: { realInformationAssets: 8, clearServiceAngle: 7, transformationOpportunity: 8, personalizedCtaPotential: 9, total: 32, reviewed: true as const, evidenceUsed: [{ source: "audit" as const, field: "servicesEvidence", detail: "Cosmetic, Restorative, Orthodontics verified" }], confidence: "HIGH" as const },
      recommendedPreviewDepth: "STRONG" as const,
      recommendedPreviewFocus: "Mobile CTA prominence; show booking path that doesn't exist yet",
      recommendedCTA: "Call the Clinic",
      recommendedHeroAngle: "Comprehensive dental and aesthetic care in Abu Dhabi",
      recommendedSections: ["services", "location"],
      outreachAngle: "Your 4.8-star clinic has no online booking – here's what your patients could experience.",
    },
  },
  {
    leadId: "lead-20260915-0094",
    name: "Al Razi City Medical Center",
    result: {
      schemaVersion: "sprint-2b.v1" as const,
      modelVersion: "manual-review-sprint-2b",
      analyzedAt: NOW,
      qualificationDecisionSource: "MANUAL_REVIEW" as const,
      qualificationDecision: "QUALIFY" as const,
      qualificationReason: "25+ years established, 4.8 stars, WhatsApp booking present. Positioning too generic – dental specialty not clearly communicated.",
      mainProblem: "Generic multi-service positioning obscures dental specialty – unclear technical/SEO presentation",
      mainProblemSeverity: "MAJOR" as const,
      secondaryProblems: [{ title: "Dental specialty unclear in hero", severity: "MAJOR" as const, evidence: "Hero combines dermatology, laser, dentistry equally" }],
      dimensions: {
        mobileResponsive: dim(4, 6, "MINOR", "Mobile layout functional"),
        heroMessageClarity: dim(2, 5, "CRITICAL", "25-year heritage and dental specialty not communicated in hero"),
        ctaContactBooking: dim(5, 8, "MINOR", "WhatsApp booking present – good"),
        visualTrustDesign: dim(3, 6, "MAJOR", "Multi-service site design dilutes specialty credibility"),
        servicesNavigation: dim(3, 4, "MINOR", "Services listed but dental buried"),
        speedPerformance: dim(3, 4, "NONE", "Adequate"),
        reviewsTeamTrust: dim(2, 3, "MINOR", "Reviews present but not prominent"),
        localSeoTechnical: dim(3, 4, "NONE", "Technical basics adequate"),
      },
      websiteOpportunityScore: 25,
      opportunityGate: gate(1, 1, "1 critical + 1 major – positioning opportunity"),
      commercialProfileScore: 7,
      commercialProfile: { score: 7, maxScore: 10, evidenceUsed: [{ source: "lead" as const, field: "rating+totalRatings", detail: "4.8/128/25yr" }], confidence: "MEDIUM" as const },
      previewPotential: { realInformationAssets: 7, clearServiceAngle: 6, transformationOpportunity: 8, personalizedCtaPotential: 7, total: 28, reviewed: true as const, evidenceUsed: [{ source: "audit" as const, field: "servicesEvidence", detail: "Dental services verified" }], confidence: "MEDIUM" as const },
      recommendedPreviewDepth: "STRONG" as const,
      recommendedPreviewFocus: "Clearer dental positioning; surface 25-year heritage and WhatsApp booking",
      recommendedCTA: "WhatsApp Us",
      recommendedHeroAngle: "Trusted dental care in Abu Dhabi for over 25 years",
      recommendedSections: ["services", "location", "booking"],
      outreachAngle: "25 years of care, but your website doesn't tell that story. Here's what it could look like.",
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Sprint 2B Manual Review Application ===`);
  console.log(`Target: ${BASE_URL}\n`);

  const previewUrls: Array<{ name: string; url: string }> = [];

  for (const { leadId, name, result } of REVIEWS) {
    process.stdout.write(`[${leadId}] ${name}\n  → Applying manual review... `);
    try {
      const applyRes = await apiFetch("/api/qualitative/manual", { leadId, result });
      console.log(`OK (${applyRes.qualificationStatus})`);

      process.stdout.write(`  → Generating preview... `);
      const previewRes = await apiFetch("/api/preview", { action: "generate", leadId });
      const rec = (previewRes as { record?: { id: string; slug: string } }).record;
      if (!rec) { console.log(`SKIP: ${JSON.stringify(previewRes)}`); continue; }

      await apiFetch("/api/preview", { action: "status", previewId: rec.id, status: "READY" });
      const slug = rec.slug.split("/").filter(Boolean).pop() ?? "";
      const url = `${BASE_URL}/dentist/${slug}`;
      console.log(`READY → ${url}`);
      previewUrls.push({ name, url });
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log();
  }

  console.log(`\n=== Published Preview URLs ===\n`);
  for (const { name, url } of previewUrls) {
    console.log(`  ${name}\n  ${url}\n`);
  }
  console.log(`Done: ${previewUrls.length}/${REVIEWS.length} published.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
