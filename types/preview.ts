// ============================================================
// Preview Builder – Core Types (Sprint 3A – V0 Prompt Builder)
// ============================================================

export const previewVerticals = ["DENTAL"] as const;
export type PreviewVertical = (typeof previewVerticals)[number];

export const dentalArchetypes = [
  "DENTAL_CORE",
  "DENTAL_PREMIUM",
  "DENTAL_SPECIALIST",
] as const;
export type DentalArchetype = (typeof dentalArchetypes)[number];
export type PreviewArchetype = DentalArchetype;

export const archetypeConfidenceLevels = ["HIGH", "MEDIUM", "LOW"] as const;
export type ArchetypeConfidence = (typeof archetypeConfidenceLevels)[number];

export const previewDepths = ["NONE", "LIGHT", "STRONG", "PREMIUM"] as const;
export type PreviewDepth = (typeof previewDepths)[number];

// ---------------------------------------------------------------
// Legacy statuses – kept for backward compat with old records
// ---------------------------------------------------------------
export const legacyPreviewStatuses = [
  "NOT_STARTED",
  "DRAFT",
  "READY",
  "ARCHIVED",
] as const;
export type LegacyPreviewStatus = (typeof legacyPreviewStatuses)[number];

// ---------------------------------------------------------------
// V0 Workflow Statuses (Sprint 3A)
// ---------------------------------------------------------------
export const v0WorkflowStatuses = [
  "NOT_STARTED",
  "BRIEF_READY",
  "PROMPT_READY",
  "IN_V0",
  "PREVIEW_LINK_ADDED",
  "READY_FOR_OUTREACH",
  "ARCHIVED",
] as const;
export type V0WorkflowStatus = (typeof v0WorkflowStatuses)[number];

// Union for DB column (covers both old and new)
export type PreviewStatus = LegacyPreviewStatus | V0WorkflowStatus;
export const previewStatuses = [...new Set([...legacyPreviewStatuses, ...v0WorkflowStatuses])] as const;

// ---------------------------------------------------------------
// CTA
// ---------------------------------------------------------------
export type CTAType = "BOOKING" | "WHATSAPP" | "PHONE" | "NONE";

export interface PreviewCTA {
  type: CTAType;
  label: string;
  /** Verified URL/tel/wa link. Null when no verified channel exists. */
  href: string | null;
}

// ---------------------------------------------------------------
// Section building blocks (legacy – kept for old PreviewConfig)
// ---------------------------------------------------------------
export interface TrustItem {
  label: string;
  value: string;
  /** Optional icon key for the frontend to resolve */
  icon?: string;
}

export interface ServiceCard {
  name: string;
  /** Brief supporting description – factual only, never invented */
  description?: string;
}

export interface LocationData {
  city: string;
  address?: string;
  googleMapsUrl?: string;
}

export interface HeroConfig {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCTA: PreviewCTA;
  secondaryCTA: PreviewCTA | null;
  /** Public image URL. Null = use gradient placeholder */
  heroImageUrl: string | null;
}

export interface DesignConfig {
  /** One of the three archetype keys */
  archetype: PreviewArchetype;
  /** Override accent color if desired */
  accentColor?: string;
}

export interface SourceEvidence {
  field: string;
  value: string;
  source: "lead" | "audit" | "qualitative";
}

// ---------------------------------------------------------------
// Full PreviewConfig (legacy auto-generated – kept for old records)
// ---------------------------------------------------------------
export interface PreviewConfig {
  leadId: string;
  slug: string;
  vertical: PreviewVertical;

  archetype: PreviewArchetype;
  archetypeConfidence: ArchetypeConfidence;
  previewDepth: PreviewDepth;

  business: {
    name: string;
    city: string;
    category: string;
    rating: number | null;
    reviewCount: number | null;
    phone: string | null;
    whatsapp: string | null;
    website: string | null;
  };

  hero: HeroConfig;

  trustItems: TrustItem[];

  services: ServiceCard[];

  /** Populated only when team evidence exists – never invented */
  team: [];

  location: LocationData | null;

  /** Additional recommended section keys, e.g. "booking-strip" */
  sections: string[];

  design: DesignConfig;

  /** Audit-derived evidence used – not exposed publicly */
  sourceEvidence: SourceEvidence[];

  /** Admin override fields */
  logoUrl: string | null;
  /** Admin can override hero image */
  heroImageUrlOverride: string | null;
}

// ---------------------------------------------------------------
// Asset confidence level
// ---------------------------------------------------------------
export const assetConfidenceLevels = ["HIGH", "MEDIUM", "LOW"] as const;
export type AssetConfidence = (typeof assetConfidenceLevels)[number];

export interface PreviewAsset {
  url: string;
  type:
    | "logo"
    | "favicon"
    | "ogImage"
    | "hero"
    | "clinic"
    | "team"
    | "service"
    | "screenshot";
  source: "admin" | "audit" | "og" | "favicon" | "scrape";
  confidence: AssetConfidence;
}

// ---------------------------------------------------------------
// Asset Pack (Sprint 3A)
// ---------------------------------------------------------------
export interface PreviewAssetPack {
  logoUrl: PreviewAsset | null;
  faviconUrl: PreviewAsset | null;
  ogImageUrl: PreviewAsset | null;
  heroImageCandidates: PreviewAsset[];
  clinicImages: PreviewAsset[];
  teamImages: PreviewAsset[];
  serviceImages: PreviewAsset[];
  currentWebsiteScreenshotUrl: PreviewAsset | null;
  sourceWebsite: string | null;
  totalAssets: number;
}

// ---------------------------------------------------------------
// Verified Facts Block (Sprint 3A)
// ---------------------------------------------------------------
export interface VerifiedFactsBlock {
  // Business identity
  businessName: string;
  category: string;
  city: string;
  country: string | null;
  currentWebsite: string | null;

  // Ratings
  googleRating: number | null;
  reviewCount: number | null;

  // Contact
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  verifiedBookingUrl: string | null;

  // Services / team
  verifiedServices: string[];
  verifiedTeamInfo: string[];
  verifiedLocation: string | null;
  verifiedSocialProfiles: string[];

  // Website audit technical
  websiteTitle: string | null;
  websiteMetaDescription: string | null;
  websiteH1: string[];
  technicalFindings: string[];
  performanceEvidence: string[];
  detectedConversionPaths: string[];

  // Qualitative recommendations
  mainProblem: string | null;
  secondaryProblems: string[];
  qualificationReason: string | null;
  outreachAngle: string | null;
  recommendedCTA: string | null;
  recommendedHeroAngle: string | null;
  recommendedSections: string[];
  previewDepth: PreviewDepth | null;
}

// ---------------------------------------------------------------
// V0 Prompt Pack (Sprint 3A)
// ---------------------------------------------------------------
export interface V0PromptSection {
  key: string;
  label: string;
  content: string;
}

export interface V0CopyPack {
  headline: string;
  subheadline: string;
  primaryCTA: string;
  secondaryCTA: string;
  trustCopy: string;
  serviceTitles: string[];
  sectionHeadings: Record<string, string>;
  locationCTA: string;
  finalCTA: string;
}

export interface V0PromptPack {
  /** The complete copy-pasteable master prompt for v0.app */
  masterPrompt: string;
  /** Individual sections for display */
  sections: V0PromptSection[];
  /** Extracted copy suggestions */
  copyPack: V0CopyPack;
  /** Archetype recommendation with reason */
  archetype: PreviewArchetype;
  archetypeReason: string;
  /** Design reference sites */
  designReferences: Array<{ name: string; url: string; purpose: string }>;
  /** Section blueprint (evidence-based only) */
  sectionBlueprint: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------
// DB record (extended for Sprint 3A)
// ---------------------------------------------------------------
export interface PreviewRecord {
  id: string;
  leadId: string;
  slug: string;
  /** Legacy status – retained for old records */
  status: PreviewStatus;
  /** New V0 workflow status */
  workflowStatus: V0WorkflowStatus;
  vertical: PreviewVertical;
  archetype: PreviewArchetype;
  archetypeConfidence: ArchetypeConfidence;
  previewDepth: PreviewDepth;
  /** Legacy auto-generated config – kept for historical records */
  configJson: PreviewConfig;
  /** Verified facts block */
  verifiedFacts: VerifiedFactsBlock | null;
  /** Asset pack */
  assetPack: PreviewAssetPack | null;
  /** V0 Prompt Pack */
  v0PromptPack: V0PromptPack | null;
  /** Final deployed preview URL (pasted by admin) */
  finalPreviewUrl: string | null;
  previewProvider: "V0" | "LEGACY" | null;
  previewAddedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
}

// ---------------------------------------------------------------
// Admin UI helpers
// ---------------------------------------------------------------
export interface PreviewListItem {
  leadId: string;
  leadName: string;
  qualification: string;
  priority: string;
  mainProblem: string;
  opportunityScore: number | null;
  recommendedDepth: PreviewDepth;
  archetype: PreviewArchetype | null;
  archetypeConfidence: ArchetypeConfidence | null;
  availableAssetCount: number;
  /** New V0 workflow status */
  workflowStatus: V0WorkflowStatus;
  /** Legacy status (for backward compat display) */
  previewStatus: PreviewStatus;
  slug: string | null;
  previewId: string | null;
  finalPreviewUrl: string | null;
  isLegacy: boolean;
}
