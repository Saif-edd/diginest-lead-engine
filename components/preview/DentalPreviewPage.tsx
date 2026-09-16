"use client";

import type { PreviewConfig, TrustItem, ServiceCard } from "@/types/preview";

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Icon Map ─────────────────────────────────────────────────────────────────

function TrustIcon({ icon }: { icon?: string }) {
  switch (icon) {
    case "star":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "phone":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366" stroke="none">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      );
    case "location":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "calendar":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

// ─── Preview Header ───────────────────────────────────────────────────────────

function PreviewHeader({
  businessName,
  phone,
  primaryCTAHref,
  primaryCTALabel,
}: {
  businessName: string;
  phone: string | null;
  primaryCTAHref: string | null;
  primaryCTALabel: string;
}) {
  return (
    <header className="preview-header">
      <div className="preview-header-inner">
        <div className="preview-logo-area">
          <div className="preview-logo-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01M15 9h.01" />
            </svg>
          </div>
          <span className="preview-logo-name">{businessName}</span>
        </div>
        <nav className="preview-nav">
          {phone && (
            <a href={`tel:${phone}`} className="preview-nav-phone">
              {phone}
            </a>
          )}
          {primaryCTAHref && (
            <a href={primaryCTAHref} className="preview-nav-cta">
              {primaryCTALabel}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

// ─── Dental Hero ──────────────────────────────────────────────────────────────

function DentalHero({
  eyebrow,
  headline,
  subheadline,
  primaryCTA,
  secondaryCTA,
  heroImageUrl,
  archetype,
}: {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCTA: PreviewConfig["hero"]["primaryCTA"];
  secondaryCTA: PreviewConfig["hero"]["secondaryCTA"];
  heroImageUrl: string | null;
  archetype: PreviewConfig["archetype"];
}) {
  const isPremium = archetype === "DENTAL_PREMIUM";

  return (
    <section className={cn("dental-hero", isPremium && "dental-hero--premium")}>
      {heroImageUrl && (
        <div className="dental-hero-image-wrap">
          <img
            src={heroImageUrl}
            alt={`${eyebrow} – dental clinic`}
            className="dental-hero-image"
          />
          <div className="dental-hero-image-overlay" />
        </div>
      )}
      {!heroImageUrl && <div className="dental-hero-gradient" />}

      <div className="dental-hero-content">
        <p className="dental-hero-eyebrow">{eyebrow}</p>
        <h1 className="dental-hero-headline">{headline}</h1>
        <p className="dental-hero-sub">{subheadline}</p>

        <div className="dental-hero-ctas">
          {primaryCTA.href && (
            <a href={primaryCTA.href} className="dental-cta-primary">
              {primaryCTA.label}
            </a>
          )}
          {secondaryCTA?.href && (
            <a href={secondaryCTA.href} className="dental-cta-secondary">
              {secondaryCTA.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Trust Strip ──────────────────────────────────────────────────────────────

function TrustStrip({ items }: { items: TrustItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="trust-strip">
      <div className="trust-strip-inner">
        {items.map((item, i) => (
          <div key={i} className="trust-item">
            <span className="trust-icon">
              <TrustIcon icon={item.icon} />
            </span>
            <div>
              <p className="trust-label">{item.label}</p>
              <p className="trust-value">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Service Grid ─────────────────────────────────────────────────────────────

function ServiceGrid({ services }: { services: ServiceCard[] }) {
  if (services.length === 0) return null;

  return (
    <section className="services-section">
      <div className="preview-container">
        <div className="section-header">
          <p className="section-eyebrow">What we offer</p>
          <h2 className="section-title">Our Services</h2>
        </div>
        <div className="services-grid">
          {services.map((service, i) => (
            <div key={i} className="service-card">
              <div className="service-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <p className="service-name">{service.name}</p>
              {service.description && (
                <p className="service-desc">{service.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Location Section ─────────────────────────────────────────────────────────

function LocationSection({
  location,
  phone,
  whatsapp,
}: {
  location: PreviewConfig["location"];
  phone: string | null;
  whatsapp: string | null;
}) {
  if (!location) return null;

  return (
    <section className="location-section">
      <div className="preview-container">
        <div className="location-inner">
          <div className="location-text">
            <p className="section-eyebrow">Find us</p>
            <h2 className="section-title">Our Location</h2>
            {location.address && <p className="location-address">{location.address}</p>}
            <div className="location-contacts">
              {phone && (
                <a href={`tel:${phone}`} className="location-contact-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {phone}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  className="location-contact-link location-whatsapp"
                >
                  WhatsApp
                </a>
              )}
            </div>
            {location.googleMapsUrl && (
              <a
                href={location.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="location-maps-link"
              >
                View on Google Maps →
              </a>
            )}
          </div>

          {location.googleMapsUrl && (
            <div className="location-map-placeholder">
              <div className="map-mock">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <p className="map-mock-label">{location.city}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Booking CTA ──────────────────────────────────────────────────────────────

function BookingCTA({
  primaryCTA,
  secondaryCTA,
  businessName,
}: {
  primaryCTA: PreviewConfig["hero"]["primaryCTA"];
  secondaryCTA: PreviewConfig["hero"]["secondaryCTA"];
  businessName: string;
}) {
  return (
    <section className="booking-cta-section">
      <div className="preview-container booking-cta-inner">
        <p className="section-eyebrow" style={{ color: "#00D4FF" }}>
          Ready to visit?
        </p>
        <h2 className="booking-cta-headline">
          Book your appointment at {businessName} today
        </h2>
        <div className="booking-cta-buttons">
          {primaryCTA.href && (
            <a href={primaryCTA.href} className="dental-cta-primary dental-cta-primary--large">
              {primaryCTA.label}
            </a>
          )}
          {secondaryCTA?.href && (
            <a href={secondaryCTA.href} className="dental-cta-secondary dental-cta-secondary--large">
              {secondaryCTA.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Preview Footer ───────────────────────────────────────────────────────────

function PreviewFooter({ businessName }: { businessName: string }) {
  return (
    <footer className="preview-footer">
      <div className="preview-container preview-footer-inner">
        <p className="preview-footer-name">{businessName}</p>
        <p className="preview-footer-badge">Concept preview by Diginest</p>
      </div>
    </footer>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const CSS = `
  /* Reset */
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
  a { text-decoration: none; }
  img { display: block; max-width: 100%; }

  /* Variables */
  :root {
    --navy: #0A1628;
    --cyan: #00D4FF;
    --white: #fff;
    --off-white: #F5F7FA;
    --text-primary: #0A1628;
    --text-muted: #6B7A90;
    --border: #E5EAF0;
  }

  /* Container */
  .preview-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

  /* Header */
  .preview-header { background: var(--navy); position: sticky; top: 0; z-index: 100; }
  .preview-header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .preview-logo-area { display: flex; align-items: center; gap: 10px; }
  .preview-logo-mark { width: 36px; height: 36px; border-radius: 8px; background: var(--cyan); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .preview-logo-name { color: white; font-size: 15px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
  .preview-nav { display: flex; align-items: center; gap: 16px; }
  .preview-nav-phone { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500; display: none; }
  @media (min-width: 640px) { .preview-nav-phone { display: block; } }
  .preview-nav-cta { background: var(--cyan); color: var(--navy); font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 6px; white-space: nowrap; }

  /* Hero */
  .dental-hero { position: relative; min-height: 520px; display: flex; align-items: flex-end; overflow: hidden; background: var(--navy); }
  @media (min-width: 768px) { .dental-hero { min-height: 640px; } }
  .dental-hero--premium { min-height: 640px; }
  @media (min-width: 768px) { .dental-hero--premium { min-height: 760px; } }

  .dental-hero-image-wrap { position: absolute; inset: 0; }
  .dental-hero-image { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; }
  .dental-hero-image-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,22,40,0.92) 0%, rgba(10,22,40,0.55) 50%, rgba(10,22,40,0.25) 100%); }
  .dental-hero-gradient { position: absolute; inset: 0; background: linear-gradient(135deg, #0A1628 0%, #0f2541 40%, #163354 100%); }
  .dental-hero-gradient::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 70% 40%, rgba(0,212,255,0.08) 0%, transparent 70%); }

  .dental-hero-content { position: relative; z-index: 10; padding: 56px 24px; max-width: 680px; margin: 0 auto; width: 100%; }
  @media (min-width: 768px) { .dental-hero-content { padding: 80px 48px; margin: 0; margin-left: max(48px, calc((100% - 1100px) / 2)); } }

  .dental-hero-eyebrow { color: var(--cyan); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 16px; }
  .dental-hero-headline { color: white; font-size: clamp(28px, 5vw, 52px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.08; margin: 0 0 20px; }
  .dental-hero-sub { color: rgba(255,255,255,0.75); font-size: clamp(15px, 2vw, 18px); line-height: 1.65; margin: 0 0 36px; max-width: 520px; }

  .dental-hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; }
  .dental-cta-primary { display: inline-flex; align-items: center; background: var(--cyan); color: var(--navy); font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 8px; letter-spacing: -0.01em; }
  .dental-cta-secondary { display: inline-flex; align-items: center; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 8px; backdrop-filter: blur(4px); }
  .dental-cta-primary--large, .dental-cta-secondary--large { font-size: 16px; padding: 16px 32px; }

  /* Trust Strip */
  .trust-strip { background: white; border-bottom: 1px solid var(--border); }
  .trust-strip-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; flex-wrap: wrap; gap: 0; }
  .trust-item { display: flex; align-items: center; gap: 12px; padding: 20px 24px; flex: 1 1 180px; border-right: 1px solid var(--border); }
  .trust-item:last-child { border-right: none; }
  @media (max-width: 640px) { .trust-item { border-right: none; border-bottom: 1px solid var(--border); } }
  .trust-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; background: #EFF9FF; display: flex; align-items: center; justify-content: center; color: var(--navy); }
  .trust-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 2px; }
  .trust-value { font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0; }

  /* Services */
  .services-section { background: var(--off-white); padding: 64px 0; }
  @media (min-width: 768px) { .services-section { padding: 80px 0; } }
  .section-header { margin-bottom: 40px; }
  .section-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; color: #00aaca; margin: 0 0 8px; }
  .section-title { font-size: clamp(22px, 4vw, 36px); font-weight: 800; letter-spacing: -0.03em; color: var(--text-primary); margin: 0; }
  .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .service-card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
  .service-icon { width: 40px; height: 40px; border-radius: 10px; background: #EFF9FF; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .service-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
  .service-desc { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.6; }

  /* Location */
  .location-section { background: white; padding: 64px 0; border-top: 1px solid var(--border); }
  @media (min-width: 768px) { .location-section { padding: 80px 0; } }
  .location-inner { display: grid; gap: 40px; }
  @media (min-width: 768px) { .location-inner { grid-template-columns: 1fr 1fr; align-items: center; } }
  .location-address { font-size: 15px; color: var(--text-muted); margin: 16px 0; line-height: 1.6; }
  .location-contacts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .location-contact-link { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .location-whatsapp { color: #25d366; }
  .location-maps-link { display: inline-block; font-size: 13px; font-weight: 600; color: #0099bb; }
  .location-map-placeholder { border-radius: 16px; overflow: hidden; background: var(--off-white); border: 1px solid var(--border); height: 240px; display: flex; align-items: center; justify-content: center; }
  .map-mock { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .map-mock-label { font-size: 13px; font-weight: 600; color: var(--text-muted); }

  /* Booking CTA */
  .booking-cta-section { background: var(--navy); padding: 72px 0; }
  @media (min-width: 768px) { .booking-cta-section { padding: 96px 0; } }
  .booking-cta-inner { text-align: center; }
  .booking-cta-headline { font-size: clamp(24px, 4vw, 40px); font-weight: 800; letter-spacing: -0.03em; color: white; margin: 0 0 36px; max-width: 600px; margin-left: auto; margin-right: auto; }
  .booking-cta-buttons { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }

  /* Footer */
  .preview-footer { background: #06101e; border-top: 1px solid rgba(255,255,255,0.05); padding: 24px 0; }
  .preview-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .preview-footer-name { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; margin: 0; }
  .preview-footer-badge { color: rgba(255,255,255,0.3); font-size: 11px; margin: 0; }
`;

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function DentalPreviewPage({
  config,
}: {
  config: PreviewConfig;
}) {
  const { hero, business, trustItems, services, location, sections, archetype } = config;

  const showServices = sections.includes("services") && services.length > 0;
  const showLocation = sections.includes("location");
  const showFinalCTA =
    config.previewDepth === "STRONG" || config.previewDepth === "PREMIUM";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PreviewHeader
        businessName={business.name}
        phone={business.phone}
        primaryCTAHref={hero.primaryCTA.href}
        primaryCTALabel={hero.primaryCTA.label}
      />

      <DentalHero
        eyebrow={hero.eyebrow}
        headline={hero.headline}
        subheadline={hero.subheadline}
        primaryCTA={hero.primaryCTA}
        secondaryCTA={hero.secondaryCTA}
        heroImageUrl={hero.heroImageUrl}
        archetype={archetype}
      />

      <TrustStrip items={trustItems} />

      {showServices && <ServiceGrid services={services} />}

      {showLocation && (
        <LocationSection
          location={location}
          phone={business.phone}
          whatsapp={business.whatsapp}
        />
      )}

      {showFinalCTA && (
        <BookingCTA
          primaryCTA={hero.primaryCTA}
          secondaryCTA={hero.secondaryCTA}
          businessName={business.name}
        />
      )}

      <PreviewFooter businessName={business.name} />
    </>
  );
}
