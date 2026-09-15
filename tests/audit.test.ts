import { describe, expect, it } from "vitest";
import { crawlWebsite, classifyError } from "../lib/audit/crawler";
import { detectHtmlSignals } from "../lib/audit/signals";
import { canTransitionAudit, transitionAuditStatus } from "../lib/audit/state";
import { emptyWebsiteAudit } from "../lib/audit/record";
import { AuditUrlError, normalizeAuditUrl } from "../lib/audit/url";

describe("audit URL normalization", () => {
  it("adds HTTPS and preserves a valid path", () => {
    expect(normalizeAuditUrl(" clinic.example/about ")).toBe(
      "https://clinic.example/about",
    );
    expect(normalizeAuditUrl("http://clinic.example")).toBe(
      "http://clinic.example/",
    );
  });

  it("rejects empty and unsupported URLs", () => {
    expect(() => normalizeAuditUrl(" ")).toThrow(AuditUrlError);
    expect(() => normalizeAuditUrl("ftp://clinic.example")).toThrow(
      AuditUrlError,
    );
  });
});

describe("audit status transitions", () => {
  it("allows the queue, audit, completion, and retry paths", () => {
    expect(canTransitionAudit("PENDING", "QUEUED")).toBe(true);
    expect(canTransitionAudit("QUEUED", "AUDITING")).toBe(true);
    expect(canTransitionAudit("AUDITING", "COMPLETE")).toBe(true);
    expect(canTransitionAudit("FAILED", "QUEUED")).toBe(true);
    expect(canTransitionAudit("COMPLETE", "QUEUED")).toBe(true);
    expect(canTransitionAudit("PENDING", "COMPLETE")).toBe(false);
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      transitionAuditStatus(emptyWebsiteAudit("PENDING"), "COMPLETE"),
    ).toThrow(/Invalid audit transition/);
  });
});

describe("deterministic HTML signal detection", () => {
  it("extracts technical fields and business evidence", () => {
    const html = `<!doctype html>
      <html lang="en"><head>
        <title>Harbor Dental Clinic</title>
        <meta name="description" content="Family dental care in Dubai">
        <meta name="robots" content="index,follow">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="canonical" href="/clinic">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":["LocalBusiness","Dentist"],"mainEntity":{"@type":"FAQPage"}}</script>
      </head><body>
        <h1>Comfortable dental care</h1>
        <a href="tel:+971501234567">Call +971 50 123 4567</a>
        <a href="https://wa.me/971501234567">WhatsApp us</a>
        <a href="mailto:hello@harbor.example">Email us</a>
        <a href="/book-appointment">Book Appointment</a>
        <form action="/contact"><input name="name"><button>Send</button></form>
        <a href="https://maps.google.com/?q=Harbor+Dental">Directions</a>
        <a href="https://www.instagram.com/harbor">Instagram</a>
        <p>Read our patient reviews. Meet our doctors. Services and treatments.</p>
        <address>Dubai Healthcare City</address>
      </body></html>`;

    const audit = detectHtmlSignals(html, "https://harbor.example/");
    expect(audit.pageTitle).toBe("Harbor Dental Clinic");
    expect(audit.metaDescription).toBe("Family dental care in Dubai");
    expect(audit.h1).toEqual(["Comfortable dental care"]);
    expect(audit.canonical).toBe("https://harbor.example/clinic");
    expect(audit.mobileViewport).toBe(true);
    expect(audit.language).toBe("en");
    expect(audit.schemaTypes).toEqual(["LocalBusiness", "Dentist", "FAQPage"]);
    expect(audit.phoneFound).toBe(true);
    expect(audit.phoneEvidence?.[0]).toContain("tel:+971501234567");
    expect(audit.whatsappFound).toBe(true);
    expect(audit.whatsappEvidence?.[0]).toContain("wa.me");
    expect(audit.emailFound).toBe(true);
    expect(audit.bookingFound).toBe(true);
    expect(audit.bookingEvidence?.[0]).toContain("Book Appointment");
    expect(audit.contactFormFound).toBe(true);
    expect(audit.contactFormEvidence?.[0]).toContain("/contact");
    expect(audit.googleMapsFound).toBe(true);
    expect(audit.socialFound).toBe(true);
    expect(audit.reviewsIndicators).toBe(true);
    expect(audit.teamIndicators).toBe(true);
    expect(audit.servicesIndicators).toBe(true);
    expect(audit.locationIndicators).toBe(true);
  });
});

describe("audit failure handling", () => {
  it("classifies common crawler failures", () => {
    expect(
      classifyError(new Error("page.goto: Timeout 30000ms exceeded")),
    ).toBe("TIMEOUT");
    expect(classifyError(new Error("getaddrinfo ENOTFOUND example.test"))).toBe(
      "DNS_ERROR",
    );
    expect(classifyError(new Error("net::ERR_CERT_AUTHORITY_INVALID"))).toBe(
      "SSL_ERROR",
    );
  });

  it("returns a visible invalid URL audit without starting a browser", async () => {
    const audit = await crawlWebsite({
      leadId: "test-invalid",
      requestedUrl: "not a valid url",
    });
    expect(audit.status).toBe("FAILED");
    expect(audit.failureReason).toBe("INVALID_URL");
    expect(audit.pageReachable).toBe(false);
  });
});
