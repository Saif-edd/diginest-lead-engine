import { describe, expect, it } from "vitest";
import { crawlWebsite, classifyError } from "../lib/audit/crawler";
import { detectHtmlSignals } from "../lib/audit/signals";
import { canTransitionAudit, recoverStaleAudit, transitionAuditStatus } from "../lib/audit/state";
import { emptyWebsiteAudit } from "../lib/audit/record";
import { AuditSsrfError, AuditUrlError, assertPublicAuditUrl, normalizeAuditUrl } from "../lib/audit/url";

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

  it("moves a completed objective audit to qualitative pending", () => {
    const next = transitionAuditStatus(emptyWebsiteAudit("AUDITING"), "COMPLETE");
    expect(next.objectiveAuditStatus).toBe("COMPLETE");
    expect(next.qualitativeAuditStatus).toBe("PENDING");
  });

  it("recovers stale auditing jobs", () => {
    const stale = recoverStaleAudit({ ...emptyWebsiteAudit("AUDITING"), startedAt: "2020-01-01T00:00:00.000Z" }, Date.parse("2020-01-01T00:20:00.000Z"));
    expect(stale.objectiveAuditStatus).toBe("FAILED");
    expect(stale.failureReason).toBe("STALE");
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
        <section class="testimonials">
          <h2>Patient Reviews</h2>
          <blockquote>“The team made my treatment comfortable and clear.” — Samira</blockquote>
        </section>
        <section>
          <h2>Meet our doctors</h2>
          <div class="doctor-card">Dr. Noor Alia, DDS — restorative dentist</div>
        </section>
        <section>
          <h2>Services</h2>
          <ul><li>Dental implants</li><li>Teeth whitening</li></ul>
        </section>
        <address>12 Healthcare Street, Dubai Healthcare City</address>
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
    expect(audit.signalEvidence?.booking?.[0]).toMatchObject({
      exactText: "Book Appointment",
      element: "a",
      href: "https://harbor.example/book-appointment",
      visible: true,
      sourceUrl: "https://harbor.example/",
    });
    expect(audit.signalEvidence?.reviews?.[0]?.detectionRule).toMatch(
      /review|testimonial/i,
    );
  });

  it("does not turn generic keywords or Contact Us into strong business signals", () => {
    const audit = detectHtmlSignals(
      `<!doctype html><html><body>
        <a href="/contact">Contact Us</a>
        <a href="https://www.google.com">Google</a>
        <a href="mailto:contact@cosmeticdentist.example">contact@cosmeticdentist.example</a>
        <a href="https://directory.example/best-pediatric-dentist-in-sharjah/">pediatric dentist in sharjah</a>
        <p>Our team works hard. Services available in Dubai.</p>
        <h2>Reviews</h2>
      </body></html>`,
      "https://example.test/",
    );
    expect(audit.bookingFound).toBe(false);
    expect(audit.googleMapsFound).toBe(false);
    expect(audit.reviewsIndicators).toBe(false);
    expect(audit.teamIndicators).toBe(false);
    expect(audit.emailFound).toBe(true);
    expect(audit.servicesIndicators).toBe(false);
    expect(audit.locationIndicators).toBe(false);
    expect(Object.keys(audit.signalEvidence ?? {})).toEqual(["email"]);
  });

  it("recognizes a strong Book a Visit CTA and a rendered WhatsApp widget", () => {
    const audit = detectHtmlSignals(
      `<html><body>
        <a href="/schedule-a-tour/"><span>Book a Visit</span></a>
        <div class="joinchat" data-settings='{"telephone":"971504928480"}'>
          <div class="joinchat__button" role="button" aria-label="WhatsApp Contact"></div>
        </div>
      </body></html>`,
      "https://example.test/",
    );
    expect(audit.bookingFound).toBe(true);
    expect(audit.bookingEvidence?.[0]).toContain("Book a Visit");
    expect(audit.whatsappFound).toBe(true);
    expect(audit.signalEvidence?.whatsapp?.[0]).toMatchObject({
      exactText: "WhatsApp Contact",
      element: "div",
      detectionRule: "WhatsApp link or visible WhatsApp widget with contact destination",
      visible: true,
      sourceUrl: "https://example.test/",
    });
  });

  it("preserves hidden state in structured evidence without counting hidden controls", () => {
    const audit = detectHtmlSignals(
      `<html><body>
        <a hidden href="https://wa.me/971500000000">WhatsApp</a>
        <a href="tel:+971501234567">+971 50 123 4567</a>
      </body></html>`,
      "https://example.test/",
    );
    expect(audit.whatsappFound).toBe(false);
    expect(audit.phoneFound).toBe(true);
    expect(audit.signalEvidence?.phone?.[0]?.visible).toBe(true);
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

  it("rejects localhost and private hosts before crawling", async () => {
    await expect(assertPublicAuditUrl("http://localhost:3000")).rejects.toBeInstanceOf(AuditSsrfError);
    await expect(assertPublicAuditUrl("http://127.0.0.1")).rejects.toBeInstanceOf(AuditSsrfError);
  });
});
