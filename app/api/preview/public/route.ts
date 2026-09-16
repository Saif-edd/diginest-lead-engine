import { NextResponse } from "next/server";
import { findPreviewBySlug } from "@/lib/persistence/db";

export const runtime = "nodejs";

/**
 * GET /api/preview/public?slug=/dentist/vision-dental-abu-dhabi
 *
 * Public endpoint for fetching preview config by slug.
 * Returns only safe, non-internal fields.
 * Used by the public preview page (/dentist/[slug]).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    const record = await findPreviewBySlug(slug);

    if (!record || record.status !== "READY") {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    // Strip internal metadata before returning publicly
    const { configJson } = record;
    const safeConfig = {
      slug: configJson.slug,
      vertical: configJson.vertical,
      archetype: configJson.archetype,
      previewDepth: configJson.previewDepth,
      business: configJson.business,
      hero: configJson.hero,
      trustItems: configJson.trustItems,
      services: configJson.services,
      // team only if explicitly populated (currently always [])
      team: configJson.team,
      location: configJson.location,
      sections: configJson.sections,
      design: configJson.design,
      // logoUrl is safe to expose (public admin-approved URL)
      logoUrl: configJson.logoUrl,
    };
    // Do NOT expose: sourceEvidence, leadId, heroImageUrlOverride (admin fields)

    return NextResponse.json({ config: safeConfig });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview lookup failed" },
      { status: 503 },
    );
  }
}
