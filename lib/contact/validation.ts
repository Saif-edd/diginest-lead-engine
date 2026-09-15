const placeholders = new Set([
  "",
  "n/a",
  "na",
  "-",
  "none",
  "null",
  "unknown",
  "not available",
]);

export function isPlaceholder(value?: string | null) {
  return placeholders.has((value ?? "").trim().toLowerCase());
}

export function isValidPhone(value?: string | null) {
  if (isPlaceholder(value)) return false;
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidEmail(value?: string | null) {
  if (isPlaceholder(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test((value ?? "").trim());
}

export function isValidSocial(value?: string | null) {
  if (isPlaceholder(value)) return false;
  try {
    const url = new URL((value ?? "").trim());
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function hasValidContactChannel(input: {
  phone?: string | null;
  email?: string | null;
  socialUrl?: string | null;
}) {
  return (
    isValidPhone(input.phone) ||
    isValidEmail(input.email) ||
    isValidSocial(input.socialUrl)
  );
}
