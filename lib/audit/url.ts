import dns from "node:dns/promises";

export class AuditUrlError extends Error {
  readonly code = "INVALID_URL" as const;
}

export class AuditSsrfError extends Error {
  readonly code = "BLOCKED" as const;
}

export function normalizeAuditUrl(input: string): string {
  const value = input.trim();
  if (!value) throw new AuditUrlError("Website URL is empty");
  const explicitProtocol = value
    .match(/^([a-z][a-z\d+.-]*):\/\//i)?.[1]
    .toLowerCase();
  if (explicitProtocol && !["http", "https"].includes(explicitProtocol)) {
    throw new AuditUrlError(`Unsupported website URL: ${input}`);
  }
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new AuditUrlError(`Invalid website URL: ${input}`);
  }
  if (!parsed.hostname || !["http:", "https:"].includes(parsed.protocol)) {
    throw new AuditUrlError(`Unsupported website URL: ${input}`);
  }
  return parsed.toString();
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "metadata.google.internal" ||
    host === "0.0.0.0" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
    host.startsWith("fe80:") || isPrivateIpv4(host);
}

export async function assertPublicAuditUrl(input: string) {
  const normalized = normalizeAuditUrl(input);
  const parsed = new URL(normalized);
  if (isPrivateHost(parsed.hostname)) throw new AuditSsrfError("Private or internal hosts are not allowed");
  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateHost(address))) {
    throw new AuditSsrfError("Website resolves to a private or internal address");
  }
  return normalized;
}
