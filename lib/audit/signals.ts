import { parseHTML } from "linkedom";
import type {
  AuditSignalEvidence,
  AuditSignalName,
  WebsiteAudit,
} from "../../types/audit";

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

function isVisible(element: Element) {
  if (element.hasAttribute("hidden")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const style = element.getAttribute("style") ?? "";
  return !/(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)/i.test(
    style,
  );
}

function nearbyContext(element: Element) {
  const parent = element.parentElement;
  return cleanText(parent?.textContent).slice(0, 240) || undefined;
}

function makeEvidence(
  element: Element,
  baseUrl: string,
  detectionRule: string,
  exactText?: string,
  contextElement: Element = element,
) : AuditSignalEvidence {
  const hrefValue = element.getAttribute("href");
  const href = hrefValue ? absoluteUrl(hrefValue, baseUrl) : undefined;
  return {
    exactText: cleanText(exactText ?? element.textContent) || href || element.tagName.toLowerCase(),
    element: element.tagName.toLowerCase(),
    ...(href ? { href } : {}),
    detectionRule,
    nearbyContext: nearbyContext(contextElement),
    visible: isVisible(element),
    sourceUrl: baseUrl,
  };
}

function evidenceKey(item: AuditSignalEvidence) {
  return `${item.element}|${item.exactText}|${item.href ?? ""}`;
}

function uniqueEvidence(items: AuditSignalEvidence[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = evidenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function legacyEvidence(items: AuditSignalEvidence[]) {
  return unique(
    items.map((item) =>
      item.href && item.exactText !== item.href
        ? `${item.exactText} - ${item.href}`
        : item.exactText,
    ),
  );
}

function elements(document: ParentNode, selector: string) {
  return Array.from(document.querySelectorAll(selector));
}

function elementHasMeaningfulText(element: Element, minimum = 8) {
  return cleanText(element.textContent).length >= minimum;
}

function collectAnchors(
  document: Document,
  baseUrl: string,
  predicate: (href: string, text: string, anchor: Element) => boolean,
  detectionRule: string,
) {
  return uniqueEvidence(
    elements(document, "a[href]")
      .filter((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        const text = cleanText(anchor.textContent);
        return isVisible(anchor) && predicate(href, text, anchor);
      })
      .map((anchor) => makeEvidence(anchor, baseUrl, detectionRule)),
  );
}

function collectInteractive(
  document: Document,
  baseUrl: string,
  predicate: (href: string, text: string, element: Element) => boolean,
  detectionRule: string,
) {
  return uniqueEvidence(
    elements(document, "a[href],button,[role='button']")
      .filter((element) => {
        const href = element.getAttribute("href") ?? "";
        const text = cleanText(element.textContent);
        return isVisible(element) && predicate(href, text, element);
      })
      .map((element) => makeEvidence(element, baseUrl, detectionRule)),
  );
}

function whatsappWidgetEvidence(document: Document, baseUrl: string) {
  return uniqueEvidence(
    elements(document, "[data-settings], [aria-label*='whatsapp' i], [class*='joinchat' i], [id*='whatsapp' i]")
      .filter((element) => {
        if (!isVisible(element)) return false;
        const attributes = `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""} ${element.getAttribute("aria-label") ?? ""}`;
        const settings = element.getAttribute("data-settings") ?? "";
        const hasTelephoneSetting = /["']?telephone["']?\s*:\s*["']?\+?\d{7,}/i.test(settings);
        return /whatsapp|joinchat/i.test(attributes) && (hasTelephoneSetting || /whatsapp/i.test(attributes));
      })
      .map((element) => {
        const labeledDescendant = elements(element, "[aria-label*='whatsapp' i]")[0];
        const label =
          element.getAttribute("aria-label") ||
          labeledDescendant?.getAttribute("aria-label") ||
          cleanText(element.textContent) ||
          "WhatsApp widget";
        return makeEvidence(
          element,
          baseUrl,
          "WhatsApp link or visible WhatsApp widget with contact destination",
          label,
        );
      }),
  );
}

const phonePattern = /(?:\+?\d[\d\s().-]{6,}\d)/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const appointmentTextPattern =
  /\b(?:appointment|book(?:\s+(?:an?|your))?\s+(?:appointment|visit)|book\s+now|schedule(?:\s+(?:an?|your))?\s+appointment|request(?:\s+(?:an?|your))?\s+appointment|make(?:\s+(?:an?|your))?\s+appointment|appointment\s+booking|reserve(?:\s+(?:an?|your))?\s+appointment|rendez[- ]vous|prendre\s+rendez[- ]vous)\b/i;
const appointmentPathPattern =
  /(?:^|[/_-])(book|booking|appointment|appointments|calendar)(?:[/_?#-]|$)/i;
const bookingProviderPattern =
  /(?:calendly\.com|doctolib\.[^/]+|zocdoc\.com|setmore\.com|acuityscheduling\.com|simplybook\.me|mindbodyonline\.com|booksy\.com|fresha\.com|nookal\.com)/i;

function contextualBlocks(document: Document, selector: string) {
  return elements(document, selector);
}

function reviewEvidence(document: Document, baseUrl: string) {
  const result: AuditSignalEvidence[] = [];
  const reviewWords =
    /testimonial|patient\s+reviews?|customer\s+reviews?|client\s+reviews?|what\s+our\s+(?:patients?|customers?|clients?)\s+say|avis\s+clients?/i;
  const reviewClass = /review|testimonial|rating|feedback/i;
  const quotePattern = /[“”"'].*\S.*[“”"']/;
  for (const element of contextualBlocks(
    document,
    "section,article,blockquote,h1,h2,h3,h4,h5,h6,[class*='review'],[id*='review'],[class*='testimonial'],[id*='testimonial'],li",
  )) {
    if (/^(html|body|main|header|footer)$/i.test(element.tagName)) continue;
    if (!isVisible(element) || !elementHasMeaningfulText(element, 18)) continue;
    const text = cleanText(element.textContent);
    const classAndId = `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""}`;
    const isHeading = /^h[1-6]$/i.test(element.tagName);
    const reviewHeading = elements(element, "h1,h2,h3,h4,h5,h6").find((heading) =>
      reviewWords.test(cleanText(heading.textContent)),
    );
    const descendantReviewHeading = Boolean(reviewHeading);
    const residualText = text.replace(reviewWords, "").trim();
    const hasReviewHeading =
      (isHeading && reviewWords.test(text) && residualText.length >= 20) ||
      (descendantReviewHeading &&
        residualText.length >= 20 &&
        (quotePattern.test(text) || /\b(?:patient|customer|client)\b|\bstars?\b|\b[1-5]\s*\/\s*5\b/i.test(residualText)));
    const hasReviewContainer =
      reviewClass.test(classAndId) &&
      (quotePattern.test(text) ||
        /\b(?:5|[1-4](?:\.\d)?)\s*(?:\/\s*5|stars?)\b/i.test(text) ||
        (reviewWords.test(text) && text.length >= 40));
    const isQuote =
      element.tagName.toLowerCase() === "blockquote" &&
      text.length >= 20 &&
      (reviewWords.test(text) || reviewClass.test(classAndId) || quotePattern.test(text));
    const googleReviewAnchor = elements(element, "a[href]").find((anchor) =>
      /google\.[^/]+|maps\.google|g\.page|goo\.gl\/maps/i.test(anchor.getAttribute("href") ?? "") &&
      /review|testimonial|rating|star/i.test(cleanText(element.textContent)),
    );
    const hasGoogleReviewContext = Boolean(googleReviewAnchor);
    if (hasReviewHeading || hasReviewContainer || isQuote || hasGoogleReviewContext) {
      const sourceElement =
        googleReviewAnchor ??
        (isQuote ? element : hasReviewHeading && reviewHeading ? reviewHeading : element);
      result.push(
        makeEvidence(
          sourceElement,
          baseUrl,
          hasReviewHeading
            ? "review/testimonial heading with supporting section content"
            : isQuote
              ? "blockquote containing review-like customer/patient text"
              : hasGoogleReviewContext
                ? "Google review link in a review context"
                : "review/testimonial container with content or rating",
          isHeading ? text : undefined,
          element,
        ),
      );
    }
  }
  return uniqueEvidence(result);
}

function teamEvidence(document: Document, baseUrl: string) {
  const result: AuditSignalEvidence[] = [];
  const teamWords = /\b(?:our\s+team|meet\s+(?:the\s+)?team|our\s+doctors?|meet\s+(?:our\s+)?doctors?|dentists?|therapists?|staff|m[eé]decins?|[eé]quipe)\b/i;
  const profileClass = /team|doctor|dentist|therapist|staff|profile|provider/i;
  const namedProviderOrCredential = /\bdr\.?\s+[A-Z][\w'-]+|\b[A-Z][\w'-]+\s+(?:DDS|DMD|MD|RN)\b/i;
  const relevantTeamLinkText = /^(?:our|meet(?:\s+the)?|the)?\s*(?:team|doctors?|dentists?|therapists?|staff|providers?)$/i;
  const relevantTeamPathSegment = /^(?:team|doctors?|dentists?|staff|therapists?|providers?|our[-_](?:team|doctors?|dentists?)|meet[-_](?:the[-_])?team)$/i;
  const relevantTeamLinkPath = (href: string) => {
    try {
      return new URL(href, baseUrl).pathname.split("/").some((segment) => relevantTeamPathSegment.test(segment));
    } catch {
      return false;
    }
  };
  for (const element of contextualBlocks(
    document,
    "section,article,h1,h2,h3,h4,h5,h6,a,[class*='team'],[id*='team'],[class*='doctor'],[id*='doctor'],[class*='dentist'],[id*='dentist'],[class*='therapist'],[id*='therapist'],[class*='staff'],[id*='staff'],[class*='profile'],[id*='profile']",
  )) {
    if (/^(html|body|main|header|footer)$/i.test(element.tagName)) continue;
    if (!isVisible(element) || !elementHasMeaningfulText(element, 12)) continue;
    const text = cleanText(element.textContent);
    const classAndId = `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""}`;
    const isHeading = /^h[1-6]$/i.test(element.tagName);
    const parentText = cleanText(element.parentElement?.textContent);
    const headingSupport =
      namedProviderOrCredential.test(parentText) ||
      elements(element.parentElement ?? element, "[class*='profile'],[class*='doctor'],[class*='team'],img[alt]").some(
        (candidate) => cleanText(candidate.textContent).length >= 12 || Boolean(candidate.getAttribute("alt")),
      );
    const headingMatch = isHeading && teamWords.test(text) && headingSupport;
    const href = element.getAttribute("href") ?? "";
    const relevantLink = element.tagName.toLowerCase() === "a" &&
      (relevantTeamLinkText.test(text) || relevantTeamLinkPath(href)) &&
      href.length > 0;
    const profile = profileClass.test(classAndId) &&
      element.tagName.toLowerCase() !== "a" &&
      (namedProviderOrCredential.test(text) ||
        (elements(element, "h2,h3,h4").some((heading) => elementHasMeaningfulText(heading, 8)) &&
          elements(element, "img[alt]").some((image) => cleanText(image.getAttribute("alt")).length >= 8))) &&
      text.length >= 18;
    const namedProvider = namedProviderOrCredential.test(text) && text.length >= 12;
    if (headingMatch || relevantLink || profile || namedProvider) {
      const providerElement = elements(element, "h2,h3,h4,h5,h6,p,li,a,[class*='profile'],[class*='doctor'],[class*='team']").find(
        (candidate) => namedProviderOrCredential.test(cleanText(candidate.textContent)),
      );
      const sourceElement = relevantLink || isHeading || profile ? element : providerElement ?? element;
      result.push(
        makeEvidence(
          sourceElement,
          baseUrl,
          headingMatch || relevantLink
            ? "team/doctor heading or relevant profile page link"
            : "staff/profile content with provider name or credential",
          isHeading || relevantLink ? text : undefined,
          element,
        ),
      );
    }
  }
  return uniqueEvidence(result);
}

const namedServicePattern =
  /\b(?:dental\s+implants?|implants?|teeth\s+whitening|whitening|cleaning|hygiene|braces?|orthodont(?:ics|ic)|invisalign|root\s+canal|veneers?|crowns?|bridges?|extractions?|physiotherapy|physical\s+therapy|massage|facial|laser|consultation|rehabilitation|acupuncture|botox|fillers?|skin\s+treatment|hair\s+removal|body\s+contouring|surgery|check[- ]?up)\b/i;

function servicesEvidence(document: Document, baseUrl: string) {
  const result: AuditSignalEvidence[] = [];
  const servicesHeading = /services?|treatments?|procedures?|what\s+we\s+(?:do|offer)|soins?|traitements?|prestations?/i;
  const servicePath = /(?:^|[/_-])(services?|treatments?|procedures?)(?:[/_?#-]|$)/i;
  for (const element of contextualBlocks(
    document,
    "section,article,h1,h2,h3,h4,h5,h6,li,a,[class*='service'],[id*='service'],[class*='treatment'],[id*='treatment'],[class*='procedure'],[id*='procedure']",
  )) {
    if (/^(html|body|main|header|footer)$/i.test(element.tagName)) continue;
    if (!isVisible(element) || !elementHasMeaningfulText(element, 18)) continue;
    const text = cleanText(element.textContent);
    const heading = /^h[1-6]$/i.test(element.tagName) && servicesHeading.test(text);
    const namedContent = namedServicePattern.test(text) || elements(element, "li").some((item) => namedServicePattern.test(cleanText(item.textContent)));
    const serviceLink = element.tagName.toLowerCase() === "a" &&
      servicePath.test(element.getAttribute("href") ?? "") &&
      (namedServicePattern.test(text) || text.length >= 18);
    if ((heading && namedContent) || (namedContent && /section|article|li|div/i.test(element.tagName)) || serviceLink) {
      const serviceItem = elements(element, "li,a").find((item) =>
        namedServicePattern.test(cleanText(item.textContent)),
      );
      const sourceElement = serviceLink || !serviceItem ? element : serviceItem;
      result.push(
        makeEvidence(
          sourceElement,
          baseUrl,
          serviceLink
            ? "named service/treatment link"
            : "service/treatment content with a named treatment or service item",
          /^h[1-6]$/i.test(element.tagName) || serviceLink ? text : undefined,
          element,
        ),
      );
    }
  }
  return uniqueEvidence(result);
}

const locationLabel = /\b(?:find\s+us|our\s+location|location|address|directions|where\s+to\s+find\s+us|adresse|localisation)\b/i;
const streetAddress = /\b\d{1,5}\s+[\w.'-]+(?:\s+[\w.'-]+){0,5}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|way|lane|ln\.?|drive|building|tower|mall|centre|center|clinic|city)\b/i;

function meaningfulAddress(text: string) {
  const cleaned = cleanText(text);
  if (cleaned.length < 8) return false;
  return streetAddress.test(cleaned) ||
    /\b(?:building|tower|floor|suite|unit|mall|healthcare|medical\s+city|district|villa|village|area)\b/i.test(cleaned);
}

function locationEvidence(document: Document, baseUrl: string) {
  const result: AuditSignalEvidence[] = [];
  for (const element of elements(document, "address,[class*='address' i],[id*='address' i],[class*='location' i],[id*='location' i],footer,section")) {
    if (/^(html|body|main|header)$/i.test(element.tagName)) continue;
    if (!isVisible(element)) continue;
    const text = cleanText(element.textContent);
    if (!meaningfulAddress(text)) continue;
    const classAndId = `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""}`;
    const semanticAddress = element.tagName.toLowerCase() === "address" || /address|location/i.test(classAndId);
    const addressLikeChild = elements(element, "address,p,li,span,a").find((candidate) =>
      isVisible(candidate) &&
      meaningfulAddress(cleanText(candidate.textContent)) &&
      cleanText(candidate.textContent).length <= 280,
    );
    const sourceElement = element.tagName.toLowerCase() === "address"
      ? element
      : addressLikeChild ?? element;
    if (semanticAddress || (locationLabel.test(text) && (streetAddress.test(text) || Boolean(addressLikeChild)))) {
      result.push(
        makeEvidence(
          sourceElement,
          baseUrl,
          element.tagName.toLowerCase() === "address"
            ? "semantic address element with meaningful business location"
            : "location/address context with meaningful address details",
          sourceElement === element ? text.slice(0, 260) : undefined,
          element,
        ),
      );
    }
  }
  return uniqueEvidence(result).slice(0, 5);
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
    if (Array.isArray(type)) {
      type.forEach((item) => {
        if (typeof item === "string") types.push(item);
      });
    }
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

function firstTextEvidence(
  document: Document,
  baseUrl: string,
  selector: string,
  pattern: RegExp,
  detectionRule: string,
) {
  return uniqueEvidence(
    elements(document, selector)
      .filter((element) => isVisible(element) && pattern.test(cleanText(element.textContent)))
      .map((element) => makeEvidence(element, baseUrl, detectionRule)),
  );
}

export function detectHtmlSignals(
  html: string,
  baseUrl: string,
): Partial<WebsiteAudit> {
  const { document } = parseHTML(html);

  const phoneEvidence = uniqueEvidence([
    ...collectAnchors(
      document,
      baseUrl,
      (href, text) => /^tel:/i.test(href) || phonePattern.test(text),
      "tel link or visible phone number in an anchor",
    ),
    ...firstTextEvidence(
      document,
      baseUrl,
      "address,footer,p,li,span",
      phonePattern,
      "visible phone number in semantic contact content",
    ),
  ]);
  const whatsappEvidence = uniqueEvidence([
    ...collectAnchors(
      document,
      baseUrl,
      (href) => /(?:wa\.me|api\.whatsapp\.com|whatsapp\.com|whatsapp:)/i.test(href),
      "WhatsApp destination URL",
    ),
    ...whatsappWidgetEvidence(document, baseUrl),
  ]);
  const emailEvidence = uniqueEvidence([
    ...collectAnchors(
      document,
      baseUrl,
      (href, text) => /^mailto:/i.test(href) || emailPattern.test(text),
      "mailto link or visible email address in an anchor",
    ),
    ...firstTextEvidence(
      document,
      baseUrl,
      "address,footer,p,li,span",
      emailPattern,
      "visible email address in semantic contact content",
    ),
  ]);
  const bookingEvidence = collectInteractive(
    document,
    baseUrl,
    (href, text) =>
      appointmentTextPattern.test(text) ||
      appointmentPathPattern.test(href) ||
      bookingProviderPattern.test(href),
    "explicit appointment CTA, appointment/calendar route, or known booking provider",
  );
  const formEvidence = uniqueEvidence(
    elements(document, "form")
      .filter(
        (form) =>
          isVisible(form) &&
          elements(form, "input,textarea,select,button").length > 0,
      )
      .map((form) => makeEvidence(form, baseUrl, "visible form with interactive input or submission control")),
  );
  const formLegacyEvidence = unique(
    formEvidence.map((item) => {
      const form = elements(document, "form").find(
        (candidate) =>
          cleanText(candidate.textContent) === item.exactText &&
          isVisible(candidate),
      );
      const action = form
        ? absoluteUrl(form.getAttribute("action"), baseUrl)
        : "";
      return action ? `${item.exactText} - ${action}` : item.exactText;
    }),
  );
  const mapsEvidence = collectAnchors(
    document,
    baseUrl,
    (href) => /(?:maps\.google\.|google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page)/i.test(href),
    "Google Maps, directions, or Google place URL",
  );
  const socialEvidence = collectAnchors(
    document,
    baseUrl,
    (href) => /(?:instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com)/i.test(href),
    "recognized social profile URL",
  );
  const reviews = reviewEvidence(document, baseUrl);
  const team = teamEvidence(document, baseUrl);
  const services = servicesEvidence(document, baseUrl);
  const locations = locationEvidence(document, baseUrl);
  const primaryCtaText = unique(
    collectAnchors(
      document,
      baseUrl,
      (_href, text) => /\b(?:book|appointment|contact|call|schedule|reserve|start|learn more|rendez[- ]vous|contactez)\b/i.test(text),
      "visible primary CTA text",
    ).map((item) => item.exactText).slice(0, 5),
  );
  const h1 = unique(
    elements(document, "h1").map((element) => cleanText(element.textContent)),
  );
  const title = cleanText(document.querySelector("title")?.textContent);
  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? undefined;
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? undefined;
  const robotsMeta = document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? undefined;
  const signalEvidence: Partial<Record<AuditSignalName, AuditSignalEvidence[]>> = {
    ...(phoneEvidence.length ? { phone: phoneEvidence } : {}),
    ...(whatsappEvidence.length ? { whatsapp: whatsappEvidence } : {}),
    ...(emailEvidence.length ? { email: emailEvidence } : {}),
    ...(bookingEvidence.length ? { booking: bookingEvidence } : {}),
    ...(formEvidence.length ? { contactForm: formEvidence } : {}),
    ...(reviews.length ? { reviews } : {}),
    ...(team.length ? { team } : {}),
    ...(services.length ? { services } : {}),
    ...(locations.length ? { location: locations } : {}),
    ...(mapsEvidence.length ? { googleMaps: mapsEvidence } : {}),
    ...(socialEvidence.length ? { social: socialEvidence } : {}),
  };
  return {
    pageTitle: title || undefined,
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || undefined,
    h1,
    canonical: canonical ? absoluteUrl(canonical, baseUrl) : undefined,
    robotsMeta,
    mobileViewport: Boolean(viewport),
    schemaTypes: schemaTypes(document),
    language: document.documentElement?.getAttribute("lang") || undefined,
    phoneFound: phoneEvidence.length > 0,
    phoneEvidence: legacyEvidence(phoneEvidence),
    whatsappFound: whatsappEvidence.length > 0,
    whatsappEvidence: legacyEvidence(whatsappEvidence),
    emailFound: emailEvidence.length > 0,
    emailEvidence: legacyEvidence(emailEvidence),
    bookingFound: bookingEvidence.length > 0,
    bookingEvidence: legacyEvidence(bookingEvidence),
    contactFormFound: formEvidence.length > 0,
    contactFormEvidence: formLegacyEvidence,
    primaryCtaText,
    googleMapsFound: mapsEvidence.length > 0,
    googleMapsEvidence: legacyEvidence(mapsEvidence),
    socialFound: socialEvidence.length > 0,
    socialEvidence: legacyEvidence(socialEvidence),
    reviewsIndicators: reviews.length > 0,
    reviewsEvidence: legacyEvidence(reviews),
    teamIndicators: team.length > 0,
    teamEvidence: legacyEvidence(team),
    servicesIndicators: services.length > 0,
    servicesEvidence: legacyEvidence(services),
    locationIndicators: locations.length > 0,
    locationEvidence: legacyEvidence(locations),
    signalEvidence,
  };
}
