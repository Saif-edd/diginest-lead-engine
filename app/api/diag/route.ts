import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DIGINEST_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.QUALITATIVE_AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.QUALITATIVE_AI_MODEL ?? "gpt-4o-mini";
  const key = process.env.QUALITATIVE_AI_API_KEY ?? "";
  
  return NextResponse.json({
    provider: {
      baseUrl,
      model,
      keyLength: key.length,
      keyPrefix: key.substring(0, 3) + "***"
    }
  });
}
