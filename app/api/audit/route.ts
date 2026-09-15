import { NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/audit/crawler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      leadId?: string;
      requestedUrl?: string;
      retryCount?: number;
    };
    if (!body.leadId || !body.requestedUrl) {
      return NextResponse.json(
        { error: "leadId and requestedUrl are required" },
        { status: 400 },
      );
    }
    const audit = await crawlWebsite({
      leadId: body.leadId,
      requestedUrl: body.requestedUrl,
      retryCount: body.retryCount,
    });
    return NextResponse.json({ audit });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Audit request failed",
      },
      { status: 500 },
    );
  }
}
