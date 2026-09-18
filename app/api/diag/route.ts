import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.DIGINEST_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpoint = (process.env.QUALITATIVE_AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const key = process.env.QUALITATIVE_AI_API_KEY;

  async function testModel(model: string) {
    const start = Date.now();
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with the exact word: PING" }]
        })
      });
      const data = await res.json();
      return { model, status: res.status, duration: Date.now() - start, ok: res.ok, data };
    } catch (e: any) {
      return { model, error: e.message, duration: Date.now() - start };
    }
  }

  const modelsToTest = [
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-002",
  ];
  const results = await Promise.all(modelsToTest.map(testModel));

  const key = process.env.QUALITATIVE_AI_API_KEY || "";
  
  const testProvider = async (url: string) => {
    try {
      const r = await fetch(url + "/models", { headers: { authorization: `Bearer ${key}` } });
      return { url, status: r.status, ok: r.ok };
    } catch {
      return { url, error: "fetch failed" };
    }
  };

  const providers = await Promise.all([
    testProvider("https://api.openai.com/v1"),
    testProvider("https://api.groq.com/openai/v1"),
    testProvider("https://openrouter.ai/api/v1"),
    testProvider("https://api.together.xyz/v1")
  ]);

  const envKeys = Object.keys(process.env).filter(k => k.includes('AI') || k.includes('API') || k.includes('TOKEN') || k.includes('KEY'));
  return NextResponse.json({
    config: {
      baseUrl: process.env.QUALITATIVE_AI_BASE_URL,
      keyPrefix: key.slice(0, 4),
      envKeys
    },
    providers,
    results
  });
}
