import crypto from "node:crypto";

const cookieName = "diginest_admin_session";
const attempts = new Map<string, number[]>();

function configuredToken() {
  return process.env.DIGINEST_ADMIN_TOKEN;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthorized(request: Request) {
  const configured = configuredToken();
  if (!configured) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const encodedCookie = request.headers.get("cookie")?.match(new RegExp(`${cookieName}=([^;]+)`))?.[1];
  let cookie: string | undefined;
  if (encodedCookie) {
    try {
      cookie = decodeURIComponent(encodedCookie);
    } catch {
      return false;
    }
  }
  return Boolean((bearer && safeEqual(bearer, configured)) || (cookie && safeEqual(cookie, configured)));
}

export function checkRateLimit(request: Request, limit = 10, windowMs = 5 * 60 * 1000) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function sessionCookie(token: string, secure = true) {
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secure ? " Secure;" : ""} Max-Age=86400`;
}

export function authConfigurationError() {
  return new Error("Production actions require DIGINEST_ADMIN_TOKEN server configuration");
}
