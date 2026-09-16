import { extractVerifiedFacts } from "../lib/preview/facts";
import { generateV0PromptPack } from "../lib/preview/v0-prompt";
import type { Lead } from "../types/lead";
import type { QualitativeResult } from "../types/qualitative";
import fs from "fs";
import path from "path";

function makeMockLead(name: string, overrides: Partial<Lead> = {}): Lead {
  return {
    leadId: `test-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    address: `123 ${name} St, Abu Dhabi`,
    category: "Dental Clinic",
    rating: 4.8,
    totalRatings: 120,
    website: `https://${name.replace(/\s+/g, '').toLowerCase()}.ae`,
    phone: "+971501234567",
    hasWebsite: true,
    qualificationStatus: "QUALIFIED",
    automaticQualification: "QUALIFIED",
    manualDecision: "NONE",
    outreachStatus: "NOT STARTED",
    followupStage: 0,
    sourceFile: "qa.csv",
    audit: {
      status: "COMPLETE",
      objectiveAuditStatus: "COMPLETE",
      qualitativeAuditStatus: "COMPLETE",
      pageReachable: true,
      phoneFound: true,
      phoneEvidence: ["+971501234567"],
      whatsappFound: true,
      whatsappEvidence: ["+971501234567"],
      bookingFound: false,
      servicesIndicators: true,
      servicesEvidence: ["General Dentistry", "Teeth Whitening", "Orthodontics", "Dental Implants"],
      locationIndicators: true,
      googleMapsFound: true,
      reviewsIndicators: true,
      teamIndicators: false,
      qualitativeResult: {
        schemaVersion: "sprint-2b.v1",
        modelVersion: "test-model",
        analyzedAt: new Date().toISOString(),
        dimensions: {} as Record<string, unknown>,
        websiteOpportunityScore: 75,
        opportunityGate: { passes: true, criticalCount: 1, majorCount: 1, reason: "Passes gate" },
        mainProblem: "Weak CTA and booking path – users cannot easily book",
        mainProblemSeverity: "CRITICAL",
        secondaryProblems: [],
        qualificationDecision: "QUALIFY",
        qualificationReason: "Strong local trust with fixable CTA issues",
        commercialProfile: { score: 8, maxScore: 10, evidenceUsed: [], confidence: "HIGH" },
        commercialProfileScore: 8,
        previewPotential: {
          realInformationAssets: 8,
          clearServiceAngle: 7,
          transformationOpportunity: 9,
          personalizedCtaPotential: 9,
          total: 33,
          reviewed: true,
          evidenceUsed: [],
          confidence: "HIGH",
        },
        outreachAngle: "Show them how easy booking could be",
        recommendedPreviewDepth: "STRONG",
        recommendedPreviewFocus: "CTA and booking path prominence",
        recommendedCTA: "BOOK AN APPOINTMENT",
        recommendedHeroAngle: `Modern dental care at ${name}`,
        recommendedSections: ["booking", "services", "contact"],
      },
    },
    reachability: { hasPhone: true, hasEmail: false, hasSocial: false },
    previewPotential: { realInformationAssets: 8, clearServiceAngle: 7, transformationOpportunity: 9, personalizedCtaPotential: 9 },
    score: {
      businessStrength: 15,
      categoryContext: 8,
      rating: 9,
      reviewVolume: 8,
      commercialProfile: 8,
      opportunity: 15,
      reachability: 7,
      previewPotential: 9,
      total: 79,
      opportunityConfirmed: true,
      priority: "P1 PREMIUM",
      isFinal: true,
      pendingComponents: [],
    },
    rawImportedData: {},
    ...overrides,
  } as Lead;
}

const leadsToGenerate = [
  makeMockLead("Vision Dental Clinic"),
  makeMockLead("ICDE", { category: "Orthodontist" }),
  makeMockLead("Harley Street Dental Center", { rating: 4.9, totalRatings: 850, address: "Harley Street, Dubai" }),
];

const outDir = path.join(process.cwd(), "scratch");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

for (const lead of leadsToGenerate) {
  const facts = extractVerifiedFacts(lead);
  const assetPack = {
    logoUrl: null,
    faviconUrl: null,
    ogImageUrl: null,
    heroImageCandidates: [],
    clinicImages: [],
    teamImages: [],
    serviceImages: [],
    currentWebsiteScreenshotUrl: null,
    sourceWebsite: lead.website ?? null,
    totalAssets: 0,
  };
  const pack = generateV0PromptPack(lead, facts, assetPack);
  
  const outFile = path.join(outDir, `${lead.name.replace(/\s+/g, '_')}_prompt.md`);
  fs.writeFileSync(outFile, pack.masterPrompt);
  console.log(`Generated: ${outFile}`);
}
