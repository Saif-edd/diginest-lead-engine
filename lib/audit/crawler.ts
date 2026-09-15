import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import serverlessChromium from "@sparticuz/chromium";
import { chromium } from "playwright-core";
import type { AuditFailureReason, WebsiteAudit } from "../../types/audit";
import { detectHtmlSignals } from "./signals";
import { emptyWebsiteAudit } from "./record";
import { AuditUrlError, normalizeAuditUrl } from "./url";

export interface CrawlWebsiteInput {
  leadId: string;
  requestedUrl: string;
  retryCount?: number;
  timeoutMs?: number;
}

const knownBrowserPaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function installedBrowserPath() {
  return knownBrowserPaths.find((browserPath) => existsSync(browserPath));
}

export function classifyError(error: unknown): AuditFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  if (
    error instanceof AuditUrlError ||
    /invalid.*url|unsupported.*url/i.test(message)
  )
    return "INVALID_URL";
  if (/timeout|timed out|exceeded/i.test(message)) return "TIMEOUT";
  if (/name_not_resolved|enotfound|dns|getaddrinfo/i.test(message))
    return "DNS_ERROR";
  if (/certificate|cert_|ssl|self signed|secure connection/i.test(message))
    return "SSL_ERROR";
  if (/blocked|403|429|access denied|forbidden/i.test(message))
    return "BLOCKED";
  return "BROWSER_ERROR";
}

function failureAudit(
  input: CrawlWebsiteInput,
  reason: AuditFailureReason,
  message: string,
  requestedUrl?: string,
  finalUrl?: string,
  httpStatus?: number,
): WebsiteAudit {
  const blocked = reason === "BLOCKED";
  return {
    ...emptyWebsiteAudit(
      blocked ? "BLOCKED" : "FAILED",
      requestedUrl ?? input.requestedUrl,
    ),
    finalUrl,
    httpStatus,
    pageReachable: false,
    https: finalUrl ? finalUrl.startsWith("https://") : undefined,
    failureReason: reason,
    failureMessage: message.slice(0, 500),
    retryCount: input.retryCount ?? 0,
    lastAttemptAt: new Date().toISOString(),
  };
}

async function dismissCookieBanner(page: import("playwright-core").Page) {
  const consent = page
    .getByRole("button", {
      name: /accept|agree|allow|got it|consent|accepter|j'accepte/i,
    })
    .first();
  await consent.click({ timeout: 1200 }).catch(() => undefined);
}

export async function crawlWebsite(
  input: CrawlWebsiteInput,
): Promise<WebsiteAudit> {
  const startedAt = Date.now();
  let requestedUrl: string;
  try {
    requestedUrl = normalizeAuditUrl(input.requestedUrl);
  } catch (error) {
    return failureAudit(
      input,
      classifyError(error),
      error instanceof Error ? error.message : String(error),
    );
  }

  let browser: import("playwright-core").Browser | undefined;
  try {
    const isVercel = Boolean(process.env.VERCEL);
    const configuredExecutable =
      process.env.DIGINest_BROWSER_PATH || installedBrowserPath();
    const executablePath =
      configuredExecutable ||
      (isVercel ? await serverlessChromium.executablePath() : undefined);
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: isVercel
        ? serverlessChromium.args
        : ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    let redirectCount = 0;
    page.on("response", (response) => {
      if (
        response.request().isNavigationRequest() &&
        response.status() >= 300 &&
        response.status() < 400
      )
        redirectCount += 1;
    });
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs ?? 30000,
    });
    const httpStatus = response?.status();
    const finalUrl = page.url();
    if (httpStatus != null && httpStatus >= 400) {
      const reason: AuditFailureReason = [401, 403, 429].includes(httpStatus)
        ? "BLOCKED"
        : "HTTP_ERROR";
      await context.close();
      return failureAudit(
        input,
        reason,
        `HTTP ${httpStatus}`,
        requestedUrl,
        finalUrl,
        httpStatus,
      );
    }
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => undefined);
    await dismissCookieBanner(page);
    const html = await page.content();
    const signals = detectHtmlSignals(html, finalUrl || requestedUrl);
    const auditTimestamp = new Date().toISOString();
    const navigationTiming = await page
      .evaluate(() => {
        const entry = performance.getEntriesByType("navigation")[0] as
          PerformanceNavigationTiming | undefined;
        return entry
          ? {
              domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
              loadEventMs: Math.round(entry.loadEventEnd),
            }
          : undefined;
      })
      .catch(() => undefined);
    const screenshotRoot = path.join(
      process.cwd(),
      "public",
      "audit-screenshots",
    );
    const screenshotDirectory = path.join(
      screenshotRoot,
      input.leadId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    );
    await fs.mkdir(screenshotDirectory, { recursive: true });
    const screenshotName = `${auditTimestamp.replace(/[:.]/g, "-")}.png`;
    const screenshotFile = path.join(screenshotDirectory, screenshotName);
    await page.screenshot({ path: screenshotFile, fullPage: false });
    await context.close();
    return {
      ...emptyWebsiteAudit("COMPLETE", requestedUrl),
      ...signals,
      requestedUrl,
      finalUrl,
      httpStatus,
      https: finalUrl.startsWith("https://"),
      redirectCount,
      pageReachable:
        httpStatus == null || (httpStatus >= 200 && httpStatus < 400),
      performance: {
        domContentLoadedMs:
          navigationTiming?.domContentLoadedMs ?? Date.now() - startedAt,
        loadEventMs: navigationTiming?.loadEventMs ?? Date.now() - startedAt,
        measuredAt: auditTimestamp,
      },
      screenshotPath: `/audit-screenshots/${input.leadId.replace(/[^a-zA-Z0-9_-]/g, "_")}/${screenshotName}`,
      auditTimestamp,
      retryCount: input.retryCount ?? 0,
      lastAttemptAt: auditTimestamp,
    };
  } catch (error) {
    const reason = classifyError(error);
    return failureAudit(
      input,
      reason,
      error instanceof Error ? error.message : String(error),
      requestedUrl,
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
