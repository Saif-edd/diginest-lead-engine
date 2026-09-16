/**
 * Preview asset resolver – Sprint 3A
 *
 * Builds a full PreviewAssetPack from a Lead.
 *
 * Priority:
 * 1. Admin override (logoUrl / heroImageUrlOverride)
 * 2. Audit screenshot URL (internal – shown to admin only)
 * 3. OG image / twitter:image from prospect's public homepage
 * 4. Favicon
 * 5. null / empty
 *
 * SSRF safety: only resolves the lead's own website domain.
 * Never leaks internal/signed Blob URLs publicly.
 * Asset failure does NOT block brief generation.
 *
 * URL VALIDATION – rejects:
 * - .jpgsvg / .webpsvg / .pngsvg and other concatenated extensions
 * - non-http(s) protocols
 * - private/localhost IPs
 * - URLs shorter than 10 characters
 * - data: URIs
 */

import type { Lead } from "@/types/lead";
import type { PreviewAssetPack, PreviewAsset, AssetConfidence } from "@/types/preview";

// ---------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------

const MALFORMED_EXTENSION_RE =
  /\.(jpe?g|png|gif|webp|svg|avif)(jpe?g|png|gif|webp|svg|avif)/i;

const PRIVATE_IP_RE =
  /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

/**
 * Returns true if the URL is a safe, publicly reachable http(s) URL
 * with no malformed extension patterns.
 */
export function isValidAssetUrl(url: string | null | undefined): url is string {
  if (!url || url.length < 10) return false;
  if (url.startsWith("data:")) return false;
  if (MALFORMED_EXTENSION_RE.test(url)) return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.hostname === "localhost") return false;
    if (PRIVATE_IP_RE.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Prefer https over http for public asset URLs. */
function isPublicHttpsUrl(url: string | null | undefined): url is string {
  if (!isValidAssetUrl(url)) return false;
  try {
    return new URL(url!).protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Asset construction helpers
// ---------------------------------------------------------------

function makeAsset(
  url: string,
  type: PreviewAsset["type"],
  source: PreviewAsset["source"],
  confidence: AssetConfidence,
): PreviewAsset {
  return { url, type, source, confidence };
}

// ---------------------------------------------------------------
// Favicon fetching
// ---------------------------------------------------------------

function buildFaviconUrl(website: string): string | null {
  try {
    const { origin } = new URL(website);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// OG image scraping
// ---------------------------------------------------------------

async function fetchOgAndFavicon(
  websiteUrl: string,
): Promise<{ ogImage: string | null; faviconHref: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Diginest-Preview-Resolver/2.0" },
    });
    clearTimeout(timeout);
    if (!response.ok) return { ogImage: null, faviconHref: null };

    const html = await response.text();

    // OG image
    let ogImage: string | null = null;
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (ogMatch?.[1] && isValidAssetUrl(ogMatch[1])) {
      ogImage = ogMatch[1];
    } else {
      // Alternate attribute order
      const ogMatch2 = html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      );
      if (ogMatch2?.[1] && isValidAssetUrl(ogMatch2[1])) {
        ogImage = ogMatch2[1];
      }
    }

    // Twitter image as fallback
    if (!ogImage) {
      const twitterMatch = html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      );
      if (twitterMatch?.[1] && isValidAssetUrl(twitterMatch[1])) {
        ogImage = twitterMatch[1];
      }
    }

    // Favicon from link tag
    let faviconHref: string | null = null;
    const faviconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    );
    if (faviconMatch?.[1]) {
      try {
        const base = new URL(websiteUrl);
        const resolved = new URL(faviconMatch[1], base).href;
        if (isValidAssetUrl(resolved)) faviconHref = resolved;
      } catch {
        // ignore
      }
    }

    return { ogImage, faviconHref };
  } catch {
    return { ogImage: null, faviconHref: null };
  }
}

// ---------------------------------------------------------------
// Main export
// ---------------------------------------------------------------

export interface AdminAssetOverrides {
  logoUrl?: string | null;
  heroImageUrlOverride?: string | null;
}

/**
 * Resolve the best available asset pack for a lead.
 *
 * This is async (OG image fetch) but never throws –
 * failures return empty/null fields gracefully.
 */
export async function resolvePreviewAssetPack(
  lead: Lead,
  adminOverrides: AdminAssetOverrides = {},
): Promise<PreviewAssetPack> {
  const assets: PreviewAsset[] = [];

  // ── 1. Admin overrides ─────────────────────────────────────────
  let logoAsset: PreviewAsset | null = null;
  if (isValidAssetUrl(adminOverrides.logoUrl)) {
    logoAsset = makeAsset(adminOverrides.logoUrl!, "logo", "admin", "HIGH");
    assets.push(logoAsset);
  }

  let heroOverrideAsset: PreviewAsset | null = null;
  if (isValidAssetUrl(adminOverrides.heroImageUrlOverride)) {
    heroOverrideAsset = makeAsset(
      adminOverrides.heroImageUrlOverride!,
      "hero",
      "admin",
      "HIGH",
    );
    assets.push(heroOverrideAsset);
  }

  // ── 2. Audit screenshot (internal) ────────────────────────────
  let screenshotAsset: PreviewAsset | null = null;
  const screenshotUrl = lead.audit.screenshotUrl;
  if (screenshotUrl && isValidAssetUrl(screenshotUrl)) {
    screenshotAsset = makeAsset(screenshotUrl, "screenshot", "audit", "HIGH");
    assets.push(screenshotAsset);
  }

  // ── 3. Fetch OG image + favicon from live website ─────────────
  let ogAsset: PreviewAsset | null = null;
  let faviconAsset: PreviewAsset | null = null;

  if (lead.website && isValidAssetUrl(lead.website)) {
    const { ogImage, faviconHref } = await fetchOgAndFavicon(lead.website);

    if (ogImage && isPublicHttpsUrl(ogImage)) {
      ogAsset = makeAsset(ogImage, "ogImage", "og", "MEDIUM");
      assets.push(ogAsset);
    }

    if (faviconHref && isValidAssetUrl(faviconHref)) {
      faviconAsset = makeAsset(faviconHref, "favicon", "favicon", "MEDIUM");
      assets.push(faviconAsset);
    } else {
      // Try standard /favicon.ico
      const defaultFav = buildFaviconUrl(lead.website);
      if (defaultFav && isValidAssetUrl(defaultFav)) {
        faviconAsset = makeAsset(defaultFav, "favicon", "favicon", "LOW");
        assets.push(faviconAsset);
      }
    }
  }

  // ── 4. Build hero candidates ───────────────────────────────────
  const heroImageCandidates: PreviewAsset[] = [];
  if (heroOverrideAsset) heroImageCandidates.push(heroOverrideAsset);
  if (ogAsset) heroImageCandidates.push(ogAsset);
  if (screenshotAsset) heroImageCandidates.push(screenshotAsset);

  // ── 5. Assemble pack ──────────────────────────────────────────
  return {
    logoUrl: logoAsset,
    faviconUrl: faviconAsset,
    ogImageUrl: ogAsset,
    heroImageCandidates,
    clinicImages: [],
    teamImages: [],
    serviceImages: [],
    currentWebsiteScreenshotUrl: screenshotAsset,
    sourceWebsite: lead.website ?? null,
    totalAssets: assets.length,
  };
}

// ---------------------------------------------------------------
// Legacy compatibility shim (used by builder.ts)
// ---------------------------------------------------------------

export interface ResolvedAssets {
  heroImageUrl: string | null;
  logoUrl: string | null;
}

export async function resolvePreviewAssets(
  lead: Lead,
  adminOverrides?: {
    logoUrl?: string | null;
    heroImageUrlOverride?: string | null;
  },
): Promise<ResolvedAssets> {
  const pack = await resolvePreviewAssetPack(lead, adminOverrides ?? {});
  return {
    heroImageUrl: pack.heroImageCandidates[0]?.url ?? null,
    logoUrl: pack.logoUrl?.url ?? null,
  };
}
