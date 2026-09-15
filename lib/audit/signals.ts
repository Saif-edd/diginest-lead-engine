import { parseHTML } from "linkedom";
import type { WebsiteAudit } from "../../types/audit";

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function absoluteUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function anchorEvidence(
  document: Document,
  pattern: RegExp,
  baseUrl: string,
  includeText = true,
) {
  return unique(
    Array.from(document.querySelectorAll("a[href]")).flatMap((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      const text = cleanText(anchor.textContent);
      if (!pattern.test(`${href} ${text}`)) return [];
      const evidence =
        includeText && text
          ? `${text} — ${absoluteUrl(href, baseUrl)}`
          : absoluteUrl(href, baseUrl);
      return [evidence];
    }),
  );
}

function textEvidence(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match ? [cleanText(match[0])] : [];
}

function schemaTypes(document: Document) {
  const types: string[] = [];
  function collect(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") types.push(type);
    if (Array.isArray(type))
      type.forEach((item) => {
        if (typeof item === "string") types.push(item);
      });
    Object.values(record).forEach((item) => {
      if (item && typeof item === "object") collect(item);
    });
  }
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((script) => {
      try {
        collect(JSON.parse(script.textContent ?? ""));
      } catch {
        /* malformed JSON-LD is simply not counted */
      }
    });
  return unique(types);
}

export function detectHtmlSignals(
  html: string,
  baseUrl: string,
): Partial<WebsiteAudit> {
  const { document } = parseHTML(html);
  const bodyText = cleanText(document.body?.textContent);
  const phoneEvidence = anchorEvidence(
    document,
    /^tel:|phone|\+?\d[\d ()-]{6,}/i,
    baseUrl,
  );
  const whatsappEvidence = anchorEvidence(
    document,
    /wa\.me|api\.whatsapp|whatsapp\.com/i,
    baseUrl,
    false,
  );
  const emailEvidence = anchorEvidence(document, /^mailto:/i, baseUrl);
  const bookingEvidence = anchorEvidence(
    document,
    /book|appointment|schedule|reserve|booking|rendez[- ]?vous|réserver|prendre rendez/i,
    baseUrl,
  );
  const contactFormEvidence = unique(
    Array.from(document.querySelectorAll("form")).map((form) => {
      const action = absoluteUrl(form.getAttribute("action"), baseUrl);
      const label = cleanText(form.textContent).slice(0, 100);
      return action || label
        ? `form${action ? ` — ${action}` : ""}${label ? ` — ${label}` : ""}`
        : "form";
    }),
  );
  const mapsEvidence = anchorEvidence(
    document,
    /google\.[^ ]*\/maps|maps\.app\.goo\.gl|directions|g\.page/i,
    baseUrl,
    false,
  );
  const socialEvidence = anchorEvidence(
    document,
    /instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com/i,
    baseUrl,
    false,
  );
  const ctaEvidence = anchorEvidence(
    document,
    /book|appointment|contact|call|schedule|reserve|start|learn more|rendez[- ]?vous|réserver|contactez/i,
    baseUrl,
  )
    .map((item) => item.split(" — ")[0])
    .slice(0, 5);
  const reviewEvidence = textEvidence(
    bodyText,
    /testimonials?|reviews?|avis clients?|patient reviews?|what our patients say/i,
  );
  const teamEvidence = textEvidence(
    bodyText,
    /our team|team|doctors?|dentists?|therapists?|médecins?|équipe/i,
  );
  const servicesEvidence = textEvidence(
    bodyText,
    /services?|treatments?|procedures?|soins?|traitements?|prestations?/i,
  );
  const locationEvidence = unique([
    ...Array.from(document.querySelectorAll("address")).map((element) =>
      cleanText(element.textContent),
    ),
    ...textEvidence(
      bodyText,
      /directions|find us|location|address|where to find us|adresse|localisation/i,
    ),
  ]).slice(0, 5);
  const viewport =
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") ??
    undefined;
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute("href") ??
    undefined;
  const robotsMeta =
    document.querySelector('meta[name="robots"]')?.getAttribute("content") ??
    undefined;
  const h1 = unique(
    Array.from(document.querySelectorAll("h1")).map((element) =>
      cleanText(element.textContent),
    ),
  );
  const title = cleanText(document.querySelector("title")?.textContent);
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() || undefined;
  return {
    pageTitle: title || undefined,
    metaDescription: description,
    h1,
    canonical: canonical ? absoluteUrl(canonical, baseUrl) : undefined,
    robotsMeta,
    mobileViewport: Boolean(viewport),
    schemaTypes: schemaTypes(document),
    language: document.documentElement?.getAttribute("lang") || undefined,
    phoneFound: phoneEvidence.length > 0,
    phoneEvidence,
    whatsappFound: whatsappEvidence.length > 0,
    whatsappEvidence,
    emailFound: emailEvidence.length > 0,
    emailEvidence,
    bookingFound: bookingEvidence.length > 0,
    bookingEvidence,
    contactFormFound: contactFormEvidence.length > 0,
    contactFormEvidence,
    primaryCtaText: unique(ctaEvidence),
    googleMapsFound: mapsEvidence.length > 0,
    googleMapsEvidence: mapsEvidence,
    socialFound: socialEvidence.length > 0,
    socialEvidence,
    reviewsIndicators: reviewEvidence.length > 0,
    reviewsEvidence: reviewEvidence,
    teamIndicators: teamEvidence.length > 0,
    teamEvidence,
    servicesIndicators: servicesEvidence.length > 0,
    servicesEvidence,
    locationIndicators: locationEvidence.length > 0,
    locationEvidence,
  };
}
