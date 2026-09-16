/**
 * Preview config builder – orchestrates all preview sub-systems.
 *
 * Produces a complete PreviewConfig from a Lead.
 * The lead must have a qualitative result attached.
 */

import type { Lead } from "@/types/lead";
import type { QualitativeResult } from "@/types/qualitative";
import type {
  PreviewConfig,
  PreviewDepth,
  LocationData,
} from "@/types/preview";
import { generateSlug } from "./slug";
import { selectDentalArchetype } from "./archetype";
import { selectCTA } from "./cta";
import { buildPreviewCopy } from "./copy";
import { resolvePreviewAssets } from "./assets";

function getQualitativeResult(lead: Lead): QualitativeResult | null {
  return lead.audit.qualitativeResult ?? null;
}

function mapDepth(depth: QualitativeResult["recommendedPreviewDepth"]): PreviewDepth {
  return depth as PreviewDepth;
}

function buildLocation(lead: Lead): LocationData | null {
  if (!lead.audit.locationIndicators && !lead.audit.googleMapsFound) return null;

  const address = lead.address;
  const city = address?.split(",")[0]?.trim() ?? undefined;

  const mapsEvidence = lead.audit.googleMapsEvidence ?? [];
  const googleMapsUrl = mapsEvidence.find((e) => e.startsWith("http")) ?? undefined;

  return {
    city: city ?? lead.address ?? "",
    address: address ?? undefined,
    googleMapsUrl,
  };
}

export interface BuildPreviewConfigOptions {
  adminLogoUrl?: string | null;
  adminHeroImageUrlOverride?: string | null;
}

export async function buildPreviewConfig(
  lead: Lead,
  options: BuildPreviewConfigOptions = {},
): Promise<PreviewConfig | null> {
  const result = getQualitativeResult(lead);
  if (!result) return null;

  const depth = mapDepth(result.recommendedPreviewDepth);
  if (depth === "NONE") return null;

  const { archetype, confidence } = selectDentalArchetype(lead, result);
  const { primaryCTA, secondaryCTA } = selectCTA(lead);

  const copy = buildPreviewCopy(lead, result, depth);

  // Asset resolution (async, never blocks)
  const assets = await resolvePreviewAssets(lead, {
    logoUrl: options.adminLogoUrl,
    heroImageUrlOverride: options.adminHeroImageUrlOverride,
  });

  // Effective hero image
  const heroImageUrl = options.adminHeroImageUrlOverride ?? assets.heroImageUrl;

  const slug = generateSlug(lead.name, copy.city, "dentist");

  const phone = lead.phone ?? null;
  const whatsapp = lead.audit.whatsappFound
    ? (lead.audit.whatsappEvidence?.[0] ?? lead.phone ?? null)
    : null;

  const config: PreviewConfig = {
    leadId: lead.leadId,
    slug,
    vertical: "DENTAL",
    archetype,
    archetypeConfidence: confidence,
    previewDepth: depth,

    business: {
      name: lead.name,
      city: copy.city,
      category: lead.category,
      rating: lead.rating ?? null,
      reviewCount: lead.totalRatings ?? null,
      phone,
      whatsapp,
      website: lead.website ?? null,
    },

    hero: {
      eyebrow: copy.heroCopy.eyebrow,
      headline: copy.heroCopy.headline,
      subheadline: copy.heroCopy.subheadline,
      primaryCTA,
      secondaryCTA,
      heroImageUrl: heroImageUrl ?? null,
    },

    trustItems: copy.trustItems,
    services: copy.services,
    team: [],

    location: buildLocation(lead),

    sections: copy.sections,

    design: {
      archetype,
    },

    sourceEvidence: copy.evidence,

    logoUrl: options.adminLogoUrl ?? null,
    heroImageUrlOverride: options.adminHeroImageUrlOverride ?? null,
  };

  return config;
}
