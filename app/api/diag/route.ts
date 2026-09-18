import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const baseUrl = process.env.QUALITATIVE_AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.QUALITATIVE_AI_MODEL ?? "gpt-4o-mini";
  const key = process.env.QUALITATIVE_AI_API_KEY ?? "";
  
  const start = Date.now();
  let status = 0;
  let body = "";
  let errorMsg = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    status = res.status;
    body = await res.text();
  } catch (e: any) {
    errorMsg = e.message;
  }

  const duration = Date.now() - start;

  return NextResponse.json({
    provider: {
      baseUrl: baseUrl.replace(/^(https?:\/\/)([^/]+).*/, "$1***$2***"), // safely masked
      model,
      keyLength: key.length,
      keyPrefix: key.substring(0, 3) + "***"
    },
    test: {
      status,
      durationMs: duration,
      errorMsg,
      body: body.substring(0, 200)
    }
  });
}
