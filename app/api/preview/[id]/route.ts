import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import { findPreviewById } from "@/lib/persistence/db";

export const runtime = "nodejs";

/**
 * GET /api/preview/[id]
 * Returns a single preview record including full prompt pack (admin only).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { id } = await context.params;
    if (!id)
      return NextResponse.json({ error: "Preview ID required" }, { status: 400 });

    const record = await findPreviewById(id);
    if (!record)
      return NextResponse.json({ error: "Preview record not found" }, { status: 404 });

    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load preview" },
      { status: 503 },
    );
  }
}
