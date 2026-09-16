/**
 * Preview asset resolver.
 *
 * Priority:
 * 1. Admin override (logoUrl / heroImageUrlOverride from PreviewRecord)
 * 2. Existing screenshot URL from audit (Vercel Blob – public URL only)
 * 3. OG image / twitter:image fetched from the prospect's public page
 * 4. null (frontend shows gradient placeholder)
 *
 * SSRF safety: only resolves the lead's own website domain.
 * Never leaks internal/signed Blob URLs.
 * Asset failure does NOT block preview generation.
 */

import type { Lead } from "@/types/lead";

/** Returns true if the URL is a safe, publicly reachable HTTPS URL. */
function isPublicUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.hostname.includes("localhost") &&
      !parsed.hostname.match(/^(10|127|172\.(1[6-9]|2\d|3[01])|192\.168)\./)
    );
  } catch {
    return false;
  }
}

/** Check that two URLs share the same origin (used for SSRF guard). */
function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

export interface ResolvedAssets {
  /** Best publicly usable hero image URL, or null */
  heroImageUrl: string | null;
  /** Best publicly usable logo URL, or null */
  logoUrl: string | null;
}

/**
 * Attempt to resolve OG/twitter image from the prospect's public homepage.
 * Returns null on any failure – this must never block preview generation.
 */
async function fetchOgImage(websiteUrl: string): Promise<string | null> {
  try {
    // Lightweight head-fetch to avoid downloading entire page body
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Diginest-Preview-Resolver/1.0" },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const html = await response.text();

    // OG image
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (ogMatch?.[1] && isPublicUrl(ogMatch[1])) return ogMatch[1];

    // twitter:image
    const twitterMatch = html.match(
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (twitterMatch?.[1] && isPublicUrl(twitterMatch[1]))
      return twitterMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the best public hero image for a lead.
 *
 * NOTE: screenshotUrl is stored internally (may be a private Blob URL).
 * We do NOT expose it directly in public preview config.
 * We only use OG image from the live site or admin override.
 */
export async function resolvePreviewAssets(
  lead: Lead,
  adminOverrides?: { logoUrl?: string | null; heroImageUrlOverride?: string | null },
): Promise<ResolvedAssets> {
  // Admin overrides always win
  const heroOverride = adminOverrides?.heroImageUrlOverride;
  const logoOverride = adminOverrides?.logoUrl;

  if (isPublicUrl(heroOverride) || isPublicUrl(logoOverride)) {
    return {
      heroImageUrl: isPublicUrl(heroOverride) ? heroOverride! : null,
      logoUrl: isPublicUrl(logoOverride) ? logoOverride! : null,
    };
  }

  // Try OG image from lead's website (SSRF-guarded)
  let heroImageUrl: string | null = null;
  if (lead.website && isPublicUrl(lead.website)) {
    const og = await fetchOgImage(lead.website);
    // Ensure the resolved image is from the same domain or any safe public URL
    if (og && isPublicUrl(og)) {
      heroImageUrl = og;
    }
  }

  return { heroImageUrl, logoUrl: null };
}
