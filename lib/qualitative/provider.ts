import type { QualitativeAnalysisInput } from "./analyzer";

export interface QualitativeProvider {
  readonly modelVersion: string;
  analyze(input: QualitativeAnalysisInput): Promise<unknown>;
}

export class QualitativeProviderError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "TIMEOUT" | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "QualitativeProviderError";
  }
}

function providerEndpoint() {
  return (process.env.QUALITATIVE_AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function providerKey() {
  return process.env.QUALITATIVE_AI_API_KEY;
}

function systemPrompt() {
  return `You are Diginest's evidence-bound website opportunity analyst. Return ONLY valid JSON matching the requested schema.

Use only the supplied verified lead context, objective audit fields, structured signal evidence, and the supplied homepage screenshot. Never invent services, prices, locations, reviews, staff, technologies, performance results, credentials, or business claims. Do not infer professional credentials from a business name, category, or suffix; do not upgrade a numeric rating into claims such as “5-star”, “glowing”, or “results” without matching supplied evidence. If evidence is unavailable, say so in the reason, use LOW confidence, and do not treat absence as a defect by itself.

The eight dimension scores are WEBSITE OPPORTUNITY points: 0 means no meaningful problem supported by evidence; the maximum means a serious opportunity. A positive deterministic signal proves presence only, not quality. Inspect presentation and hierarchy in the screenshot before calling a CTA, reviews, team, or services experience weak. Desktop evidence cannot prove mobile behavior; use the verified viewport field only as technical evidence.

CRITICAL ANTI-HALLUCINATION GUARDS:
1. Absence of a booking signal (booking=false) means absence of detected booking only; it does not automatically make the CTA quality CRITICAL.
2. Do not use HTTP origin as evidence of visual design quality.
3. Do not infer that Hero/Message Clarity is poor solely because an H1 tag is missing (h1=[]).
4. Maintain LOW confidence for all visual dimensions when screenshotAvailable is false.
5. Avoid absolute SEO claims (e.g., "Google cannot rank this") or strong unprovable causal claims (e.g., "destroys patient trust").

Booking is not poor merely because a booking signal is absent. Reviews, team, services, and location presence are not quality scores by themselves. Keep the mainProblem to one strongest evidence-supported problem. Use qualificationDecision QUALIFY only when the opportunity gate is satisfied; otherwise use HOLD or SKIP. recommendedSections and all recommendations must use only factual business context and the observed problem.

Every evidenceUsed item must reference a supplied field with source lead, audit, signal, or screenshot. If a claim has no valid supplied reference, leave evidenceUsed empty and lower confidence. Use only these field names: lead = name, category, address, rating, reviewCount, phone, email, socialUrl; audit = objectiveAuditStatus, requestedUrl, finalUrl, httpStatus, https, redirectCount, pageReachable, pageTitle, metaDescription, h1, canonical, robotsMeta, mobileViewport, schemaTypes, language, performance, auditTimestamp; signal = phone, whatsapp, email, booking, contactForm, reviews, team, services, location, googleMaps, social; screenshot = homepage. Do not use pageContent, url, content, screenshotUrl, or any other field name. For screenshot, use field homepage.`;
}

function userPrompt(input: QualitativeAnalysisInput) {
  return `Analyze this verified website context. Scores and severity must be internally consistent. Include every required field from the JSON shape.

VERIFIED_CONTEXT:
${JSON.stringify(input.context, null, 2)}

JSON SHAPE:
{
  "schemaVersion":"sprint-2b.v1",
  "dimensions": {
    "mobileResponsive":{"score":0,"maxScore":6,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[{"source":"lead|audit|signal|screenshot","field":"","detail":""}],"confidence":"HIGH|MEDIUM|LOW"},
    "heroMessageClarity":{"score":0,"maxScore":5,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "ctaContactBooking":{"score":0,"maxScore":8,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "visualTrustDesign":{"score":0,"maxScore":6,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "servicesNavigation":{"score":0,"maxScore":4,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "speedPerformance":{"score":0,"maxScore":4,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "reviewsTeamTrust":{"score":0,"maxScore":3,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
    "localSeoTechnical":{"score":0,"maxScore":4,"severity":"NONE|MINOR|MAJOR|CRITICAL","reason":"","evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"}
  },
  "mainProblem":"","mainProblemSeverity":"NONE|MINOR|MAJOR|CRITICAL","secondaryProblems":[{"title":"","severity":"NONE|MINOR|MAJOR|CRITICAL","evidence":""}],
  "qualificationDecision":"QUALIFY|HOLD|SKIP","qualificationReason":"",
  "commercialProfile":{"score":0,"maxScore":5,"evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
  "previewPotential":{"realInformationAssets":0,"clearServiceAngle":0,"transformationOpportunity":0,"personalizedCtaPotential":0,"evidenceUsed":[],"confidence":"HIGH|MEDIUM|LOW"},
  "outreachAngle":"","recommendedPreviewDepth":"NONE|LIGHT|STRONG|PREMIUM","recommendedPreviewFocus":"","recommendedCTA":"","recommendedHeroAngle":"","recommendedSections":[]
}

Do not include markdown fences or commentary.`;
}

export class OpenAICompatibleQualitativeProvider implements QualitativeProvider {
  readonly modelVersion: string;

  constructor(
    private readonly apiKey: string,
    // OVERRIDE: gemini-3.8-flash is currently experiencing an active outage (503), falling back to 3.6-flash
    modelVersion = process.env.QUALITATIVE_AI_MODEL?.replace("3.8-flash", "3.6-flash") ?? "gpt-4o-mini",
  ) {
    this.modelVersion = modelVersion;
  }

  async analyze(input: QualitativeAnalysisInput) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.QUALITATIVE_AI_TIMEOUT_MS ?? 45000));
    try {
      const userContent: Array<Record<string, unknown>> = [
        { type: "text", text: userPrompt(input) },
      ];
      // OVERRIDE: Drop screenshot to bypass Gemini TPM strict limits which cause 429/503
      // if (input.screenshotDataUrl) {
      //   userContent.push({ type: "image_url", image_url: { url: input.screenshotDataUrl, detail: "high" } });
      // }
      const request = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelVersion,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: userContent },
          ],
        }),
        signal: controller.signal,
      };
      let response: Response | undefined;
      let payload: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(`${providerEndpoint()}/chat/completions`, request);
        const rawBody = await response.text();
        try { payload = JSON.parse(rawBody) as Record<string, unknown>; } catch { payload = {}; }
        if (response.ok) break;
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
          const error = typeof payload.error === "object" && payload.error ? payload.error as Record<string, unknown> : undefined;
          const detail = typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : rawBody.trim() || undefined;
          const retryAfter = response.headers.get("retry-after");
          const suffix = retryAfter ? ` (retry-after: ${retryAfter})` : "";
          throw new QualitativeProviderError(`Qualitative provider returned HTTP ${response.status}: ${String(error?.message ?? detail ?? "unknown error")}${suffix}`.slice(0, 500), "PROVIDER_ERROR");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
      }
      if (!response?.ok) throw new QualitativeProviderError("Qualitative provider request failed", "PROVIDER_ERROR");
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message : undefined;
      const content = message && typeof message === "object" ? (message as Record<string, unknown>).content : undefined;
      const text = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part) => typeof part === "object" && part ? String((part as Record<string, unknown>).text ?? "") : "").join("")
          : "";
      if (!text.trim()) throw new QualitativeProviderError("Qualitative provider returned no JSON content", "PROVIDER_ERROR");
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new QualitativeProviderError("Qualitative provider returned invalid JSON", "PROVIDER_ERROR");
      }
    } catch (error) {
      const safeUrl = providerEndpoint().replace(/^(https?:\/\/)([^/]+).*/, "$1***$2***");
      const meta = ` (${safeUrl} - ${this.modelVersion})`;
      if (error instanceof QualitativeProviderError) {
        if (!error.message.includes(safeUrl)) {
          throw new QualitativeProviderError(error.message + meta, error.code);
        }
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") throw new QualitativeProviderError("Qualitative provider timed out" + meta, "TIMEOUT");
      throw new QualitativeProviderError((error instanceof Error ? error.message.slice(0, 500) : "Qualitative provider request failed") + meta, "PROVIDER_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createQualitativeProvider(): QualitativeProvider {
  const apiKey = providerKey();
  if (!apiKey) throw new QualitativeProviderError("QUALITATIVE_AI_API_KEY is not configured", "NOT_CONFIGURED");
  return new OpenAICompatibleQualitativeProvider(apiKey);
}
