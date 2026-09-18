import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.DIGINEST_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    QUALITATIVE_AI_BASE_URL: process.env.QUALITATIVE_AI_BASE_URL,
    QUALITATIVE_AI_MODEL: process.env.QUALITATIVE_AI_MODEL,
    QUALITATIVE_AI_API_KEY: process.env.QUALITATIVE_AI_API_KEY ? process.env.QUALITATIVE_AI_API_KEY.slice(0, 8) + "..." : undefined,
  });
}
