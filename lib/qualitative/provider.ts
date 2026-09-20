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

function providerTimeoutMs() {
  const configured = Number(process.env.QUALITATIVE_AI_TIMEOUT_MS ?? 90_000);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 120_000)
    : 90_000;
}

function defaultModelFor(baseUrl: string) {
  return /api\.groq\.com/i.test(baseUrl)
    ? "openai/gpt-oss-20b"
    : "gpt-4o-mini";
}

function normalizeBaseUrl(value: string | undefined) {
  return (value ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function supportsVision(model: string, baseUrl: string) {
  if (!/api\.groq\.com/i.test(baseUrl)) return true;
  return /qwen\/qwen3\.(6|8)-27b|meta-llama\/llama-4-(scout|maverick)/i.test(model);
}

function systemPrompt() {
  return `You are Diginest's evidence-bound website opportunity analyst. Return ONLY valid JSON matching the requested schema.

Use only the supplied verified lead context, objective audit fields, structured signal evidence, and the supplied homepage screenshot. Never invent services, prices, locations, reviews, staff, technologies, performance results, credentials, or business claims. Do not infer professional credentials from a business name, category, or suffix; do not upgrade a numeric rating into claims such as \u201c5-star\u201d, \u201cglowing\u201d, or \u201cresults\u201d without matching supplied evidence. If evidence is unavailable, say so in the reason, use LOW confidence, and do not treat absence as a defect by itself.

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

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function resolveProviderChain(): ProviderConfig[] {
  const chain: ProviderConfig[] = [];
  if (process.env.QUALITATIVE_AI_API_KEY) {
    const baseUrl = normalizeBaseUrl(process.env.QUALITATIVE_AI_BASE_URL);
    chain.push({
      baseUrl,
      apiKey: process.env.QUALITATIVE_AI_API_KEY,
      model: process.env.QUALITATIVE_AI_MODEL ?? defaultModelFor(baseUrl),
    });
  }
  if (process.env.QUALITATIVE_AI_FALLBACK_API_KEY) {
    const baseUrl = normalizeBaseUrl(process.env.QUALITATIVE_AI_FALLBACK_BASE_URL);
    chain.push({
      baseUrl,
      apiKey: process.env.QUALITATIVE_AI_FALLBACK_API_KEY,
      model: process.env.QUALITATIVE_AI_FALLBACK_MODEL ?? defaultModelFor(baseUrl),
    });
  }
  if (!chain.length) {
    throw new QualitativeProviderError("QUALITATIVE_AI_API_KEY is not configured", "NOT_CONFIGURED");
  }
  return chain;
}

export class OpenAICompatibleQualitativeProvider implements QualitativeProvider {
  readonly modelVersion: string;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    modelVersion: string | undefined = undefined,
    baseUrl = "https://api.openai.com/v1",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.modelVersion = modelVersion ?? defaultModelFor(this.baseUrl);
  }

  async analyze(input: QualitativeAnalysisInput) {
    const controller = new AbortController();
    const timeoutMs = providerTimeoutMs();
    const deadline = Date.now() + timeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const includeScreenshot = Boolean(input.screenshotDataUrl) && supportsVision(this.modelVersion, this.baseUrl);
      const effectiveInput = includeScreenshot || !input.screenshotDataUrl
        ? input
        : {
            ...input,
            context: {
              ...input.context,
              objectiveAudit: {
                ...input.context.objectiveAudit,
                screenshotAvailable: false,
                screenshotError: "The configured provider model does not support image input.",
              },
            },
            screenshotDataUrl: undefined,
          };
      const userContent: Array<Record<string, unknown>> = [
        { type: "text", text: userPrompt(effectiveInput) },
      ];
      if (includeScreenshot && effectiveInput.screenshotDataUrl) {
        userContent.push({ type: "image_url", image_url: { url: effectiveInput.screenshotDataUrl } });
      }
      const request = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelVersion,
          temperature: 0,
          ...(/api\.groq\.com/i.test(this.baseUrl) && /^openai\/gpt-oss-/i.test(this.modelVersion)
            ? { reasoning_effort: "low" }
            : {}),
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
      const maxAttempts = 4;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        response = await fetch(`${this.baseUrl}/chat/completions`, request);
        const rawBody = await response.text();
        try { payload = JSON.parse(rawBody) as Record<string, unknown>; } catch { payload = {}; }
        if (response.ok) break;
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts - 1) {
          const error = typeof payload.error === "object" && payload.error ? payload.error as Record<string, unknown> : undefined;
          const detail = typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : rawBody.trim() || undefined;
          const retryAfter = response.headers.get("retry-after");
          const suffix = retryAfter ? ` (retry-after: ${retryAfter})` : "";
          throw new QualitativeProviderError(`Qualitative provider returned HTTP ${response.status}: ${String(error?.message ?? detail ?? "unknown error")}${suffix}`.slice(0, 500), "PROVIDER_ERROR");
        }
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** attempt;
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          throw new QualitativeProviderError("Qualitative provider timed out", "TIMEOUT");
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, remainingMs)));
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
      const safeUrl = this.baseUrl.replace(/^(https?:\/\/)([^/]+).*/, "$1***$2***");
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
  const chain = resolveProviderChain().map(
    (config) => new OpenAICompatibleQualitativeProvider(config.apiKey, config.model, config.baseUrl),
  );
  return {
    modelVersion: chain[0].modelVersion,
    async analyze(input: QualitativeAnalysisInput) {
      let lastError: unknown;
      for (const provider of chain) {
        try {
          return await provider.analyze(input);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new QualitativeProviderError("All qualitative providers failed", "PROVIDER_ERROR");
    },
  };
}
