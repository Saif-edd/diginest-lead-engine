import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";

export const runtime = "nodejs";

type ProviderCheck = {
  configured: boolean;
  status?: number;
  ok?: boolean;
  durationMs: number;
  error?: string;
};

function providerEndpoint() {
  return (process.env.QUALITATIVE_AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function providerModel() {
  return process.env.QUALITATIVE_AI_MODEL ?? "gpt-4o-mini";
}

async function checkConfiguredProvider(): Promise<ProviderCheck> {
  const startedAt = Date.now();
  const apiKey = process.env.QUALITATIVE_AI_API_KEY;
  if (!apiKey) {
    return { configured: false, durationMs: 0, error: "QUALITATIVE_AI_API_KEY is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${providerEndpoint()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: providerModel(),
        messages: [{ role: "user", content: "Reply with the exact word: PING" }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });
    return {
      configured: true,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      ...(!response.ok ? { error: `Provider returned HTTP ${response.status}` } : {}),
    };
  } catch (error) {
    return {
      configured: true,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error && error.name === "AbortError"
        ? "Provider diagnostic timed out"
        : "Provider diagnostic request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkConfiguredProvider();
  return NextResponse.json({
    config: {
      baseUrl: providerEndpoint(),
      model: providerModel(),
      keyConfigured: Boolean(process.env.QUALITATIVE_AI_API_KEY),
    },
    provider: result,
  });
}
