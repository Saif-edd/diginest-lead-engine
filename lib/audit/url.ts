export class AuditUrlError extends Error {
  readonly code = "INVALID_URL" as const;
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
