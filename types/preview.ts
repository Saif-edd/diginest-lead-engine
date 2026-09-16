// ============================================================
// Preview Builder – Core Types (Day 6)
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

export const previewStatuses = [
  "NOT_STARTED",
  "DRAFT",
  "READY",
  "ARCHIVED",
] as const;
export type PreviewStatus = (typeof previewStatuses)[number];

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
// Section building blocks
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
// Full PreviewConfig
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
// DB record
// ---------------------------------------------------------------
export interface PreviewRecord {
  id: string;
  leadId: string;
  slug: string;
  status: PreviewStatus;
  vertical: PreviewVertical;
  archetype: PreviewArchetype;
  archetypeConfidence: ArchetypeConfidence;
  previewDepth: PreviewDepth;
  configJson: PreviewConfig;
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
  recommendedDepth: PreviewDepth;
  previewStatus: PreviewStatus;
  slug: string | null;
  previewId: string | null;
  archetypeConfidence: ArchetypeConfidence | null;
}
