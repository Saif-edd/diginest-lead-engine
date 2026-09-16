"use client";

import type { PreviewConfig, TrustItem, ServiceCard } from "@/types/preview";
import { Star, Phone, MapPin, Calendar, Menu, X, ArrowRight } from "lucide-react";
import React, { useState } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/\.(jpg|jpeg|png|webp|gif|svg)(jpg|jpeg|png|webp|gif|svg)$/i.test(url)) return false;
  if (!url.startsWith("http")) return false;
  return true;
}

function getWhatsAppHref(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

function formatRating(rating: number | null, reviewCount: number | null): string | null {
  if (!rating) return null;
  const ratingStr = `${rating} Google rating`;
  if (reviewCount) return `${ratingStr} · ${reviewCount.toLocaleString()} reviews`;
  return ratingStr;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

type ArchetypeKey = "DENTAL_CORE" | "DENTAL_PREMIUM" | "DENTAL_SPECIALIST";

const PALETTE: Record<ArchetypeKey, {
  primary: string; accent: string; bg: string; bgAlt: string;
  dark: string; darkSection: string; navBorder: string;
}> = {
  DENTAL_CORE: {
    primary: "#1B6FBF", accent: "#4EA8E4", bg: "bg-white", bgAlt: "bg-slate-50",
    dark: "#0D1F3C", darkSection: "#0f172a", navBorder: "border-slate-200",
  },
  DENTAL_PREMIUM: {
    primary: "#0B2D5E", accent: "#C9A96E", bg: "bg-[#FDFCF8]", bgAlt: "bg-white",
    dark: "#0B2D5E", darkSection: "#0B2D5E", navBorder: "border-stone-200",
  },
  DENTAL_SPECIALIST: {
    primary: "#193866", accent: "#2A7D4F", bg: "bg-white", bgAlt: "bg-[#F2F6F9]",
    dark: "#0F2744", darkSection: "#193866", navBorder: "border-slate-200",
  },
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function WaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function TrustIcon({ icon }: { icon?: string }) {
  if (icon === "star") return <Star className="fill-yellow-400 text-yellow-400" size={20} />;
  if (icon === "phone") return <Phone size={20} />;
  if (icon === "location") return <MapPin size={20} />;
  if (icon === "calendar") return <Calendar size={20} />;
  if (icon === "whatsapp") return <WaIcon className="w-5 h-5 text-[#25D366]" />;
  return <Star size={20} />;
}

// ─── Shared: Navbar ──────────────────────────────────────────────────────────

function Navbar({
  businessName, logoUrl, primaryCTA, archetype,
}: {
  businessName: string;
  logoUrl: string | null;
  primaryCTA: PreviewConfig["hero"]["primaryCTA"];
  archetype: ArchetypeKey;
}) {
  const [open, setOpen] = useState(false);
  const p = PALETTE[archetype];
  const isPremium = archetype === "DENTAL_PREMIUM";

  return (
    <header className={cn("sticky top-0 z-50 border-b backdrop-blur-md shadow-sm", isPremium ? "bg-[#FDFCF8]/95" : "bg-white/95", p.navBorder)}>
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="#" className="shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="h-10 w-auto object-contain" />
          ) : (
            <span
              className="text-lg font-bold leading-tight max-w-[180px] sm:max-w-none truncate"
              style={{ color: p.dark }}
            >
              {businessName}
            </span>
          )}
        </a>

        {/* Desktop CTA */}
        {primaryCTA.href && (
          <a
            href={primaryCTA.href}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all shadow-sm"
            style={{ backgroundColor: isPremium ? p.accent : p.primary }}
          >
            {primaryCTA.label}
          </a>
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {primaryCTA.href && (
            <a
              href={primaryCTA.href}
              className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold text-white"
              style={{ backgroundColor: p.primary }}
            >
              {primaryCTA.label}
            </a>
          )}
        </div>
      )}
    </header>
  );
}

// ─── AnnouncementBar ─────────────────────────────────────────────────────────

function AnnouncementBar({ phone, archetype }: { phone: string | null; archetype: ArchetypeKey }) {
  if (!phone) return null;
  const p = PALETTE[archetype];
  return (
    <div className="hidden sm:flex items-center justify-center gap-6 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-white/90" style={{ backgroundColor: p.darkSection }}>
      <span className="flex items-center gap-1.5">
        <Phone size={11} className="opacity-70" />
        <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
      </span>
      <span className="h-3 w-px bg-white/20" />
      <span className="opacity-60">Open for appointments</span>
    </div>
  );
}

// ─── DENTAL_CORE Hero (WebDentts-inspired full bleed) ────────────────────────

function CoreHero({ hero, business }: { hero: PreviewConfig["hero"]; business: PreviewConfig["business"] }) {
  const ratingStr = formatRating(business.rating, business.reviewCount);
  const heroImg = isValidImageUrl(hero.heroImageUrl) ? hero.heroImageUrl : null;
  const waHref = getWhatsAppHref(business.whatsapp);

  return (
    <section className="relative min-h-[100svh] flex items-center pt-[4.5rem] pb-12 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {heroImg ? (
          <img
            src={heroImg}
            alt="Clinic"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0D1F3C] to-[#1B6FBF]" />
        )}
        {/* Gradient overlay — WebDentts style left-heavy */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/30" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 w-full">
        <div className="max-w-2xl">
          {/* Eyebrow pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "#1B6FBF22", color: "#4EA8E4", border: "1px solid #4EA8E433" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4EA8E4] animate-pulse" />
            {hero.eyebrow}
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {hero.headline}
          </h1>

          <p className="text-base sm:text-xl text-white/75 mb-10 max-w-xl leading-relaxed">
            {hero.subheadline}
          </p>

          {/* CTAs — stacked on mobile, row on sm+ */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            {hero.primaryCTA.href && (
              <a
                href={hero.primaryCTA.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold text-white transition-all shadow-lg hover:opacity-90"
                style={{ backgroundColor: "#1B6FBF" }}
              >
                <Calendar size={17} />
                {hero.primaryCTA.label}
              </a>
            )}
            {hero.secondaryCTA?.href && (
              <a
                href={hero.secondaryCTA.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold text-white border-2 border-white/30 bg-white/10 backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <Phone size={17} />
                {hero.secondaryCTA.label}
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold border-2 transition-all"
                style={{ borderColor: "#25D366", color: "#25D366", background: "rgba(37,211,102,0.08)" }}
              >
                <WaIcon className="w-[17px] h-[17px]" />
                WhatsApp
              </a>
            )}
          </div>

          {/* Rating — factual only */}
          {ratingStr && (
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <span className="flex">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={15} className={cn("fill-current", i <= Math.round(business.rating ?? 0) ? "text-yellow-400" : "text-white/20")} />
                ))}
              </span>
              <span>{ratingStr}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── DENTAL_PREMIUM Hero (editorial split layout) ───────────────────────────

function PremiumHero({ hero, business }: { hero: PreviewConfig["hero"]; business: PreviewConfig["business"] }) {
  const ratingStr = formatRating(business.rating, business.reviewCount);
  const heroImg = isValidImageUrl(hero.heroImageUrl) ? hero.heroImageUrl : null;

  return (
    <section className="bg-[#FDFCF8] pt-8 pb-0 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-end">
          {/* Left: Text */}
          <div className="pt-12 pb-16 lg:pb-24">
            {/* Eyebrow */}
            <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#C9A96E" }}>
              {hero.eyebrow}
            </p>

            {/* Headline — large, light weight for premium feel */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-light tracking-tight leading-[1.1] mb-6" style={{ color: "#0B2D5E" }}>
              {hero.headline}
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-10 max-w-lg">
              {hero.subheadline}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              {hero.primaryCTA.href && (
                <a
                  href={hero.primaryCTA.href}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold text-white transition-all shadow-md hover:opacity-90"
                  style={{ backgroundColor: "#C9A96E" }}
                >
                  {hero.primaryCTA.label}
                  <ArrowRight size={16} />
                </a>
              )}
              {hero.secondaryCTA?.href && (
                <a
                  href={hero.secondaryCTA.href}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold border transition-all hover:bg-slate-50"
                  style={{ borderColor: "#0B2D5E33", color: "#0B2D5E" }}
                >
                  <Phone size={16} />
                  {hero.secondaryCTA.label}
                </a>
              )}
            </div>

            {/* Rating */}
            {ratingStr && (
              <div className="flex items-center gap-3">
                <span className="flex">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={14} className={cn("fill-current", i <= Math.round(business.rating ?? 0) ? "text-[#C9A96E]" : "text-slate-200")} />
                  ))}
                </span>
                <span className="text-sm font-medium text-slate-600">{ratingStr}</span>
              </div>
            )}
          </div>

          {/* Right: Image with decorative frame */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg">
              {/* Decorative rotated background */}
              <div className="absolute -inset-3 rotate-2 rounded-[2rem] opacity-20" style={{ backgroundColor: "#C9A96E" }} aria-hidden />
              {/* Image container */}
              <div className="relative overflow-hidden rounded-[1.75rem] shadow-2xl ring-8 ring-white aspect-[4/5]">
                {heroImg ? (
                  <img src={heroImg} alt="Clinic" className="w-full h-full object-cover object-center" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B2D5E] to-[#1a4a8a]" />
                )}
              </div>
              {/* Floating rating card */}
              {ratingStr && (
                <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-xl p-4 min-w-[160px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={14} className={cn("fill-current", i <= Math.round(business.rating ?? 0) ? "text-yellow-400" : "text-slate-200")} />
                      ))}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "#0B2D5E" }}>{business.rating}</span>
                  </div>
                  <p className="text-xs text-slate-500">{business.reviewCount?.toLocaleString()} Google reviews</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── DENTAL_SPECIALIST Hero (dark authority layout) ──────────────────────────

function SpecialistHero({ hero, business }: { hero: PreviewConfig["hero"]; business: PreviewConfig["business"] }) {
  const ratingStr = formatRating(business.rating, business.reviewCount);
  const heroImg = isValidImageUrl(hero.heroImageUrl) ? hero.heroImageUrl : null;
  const waHref = getWhatsAppHref(business.whatsapp);

  return (
    <section className="pt-0 pb-0 overflow-hidden" style={{ backgroundColor: "#0F2744" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-0 items-stretch min-h-[90svh]">
          {/* Left: dark text */}
          <div className="flex flex-col justify-center py-20 pr-0 lg:pr-12">
            {/* Specialist badge */}
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ backgroundColor: "#2A7D4F22", color: "#5cb888", border: "1px solid #2A7D4F44" }}>
              {business.category}
            </div>

            {/* Eyebrow */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">{hero.eyebrow}</p>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
              {hero.headline}
            </h1>

            <p className="text-base text-white/60 leading-relaxed mb-10 max-w-md">
              {hero.subheadline}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              {hero.primaryCTA.href && (
                <a
                  href={hero.primaryCTA.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold text-white transition-all shadow-lg hover:opacity-90"
                  style={{ backgroundColor: "#2A7D4F" }}
                >
                  <Calendar size={17} />
                  {hero.primaryCTA.label}
                </a>
              )}
              {hero.secondaryCTA?.href && (
                <a
                  href={hero.secondaryCTA.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold text-white/80 border border-white/20 hover:bg-white/10 transition-all"
                >
                  <Phone size={17} />
                  {hero.secondaryCTA.label}
                </a>
              )}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm font-bold border border-[#25D366]/30 text-[#5cd981] hover:bg-[#25D366]/10 transition-all"
                >
                  <WaIcon className="w-[17px] h-[17px]" />
                  WhatsApp
                </a>
              )}
            </div>

            {/* Rating */}
            {ratingStr && (
              <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="flex">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={14} className={cn("fill-current", i <= Math.round(business.rating ?? 0) ? "text-yellow-400" : "text-white/20")} />
                  ))}
                </span>
                <span>{ratingStr}</span>
              </div>
            )}
          </div>

          {/* Right: Image panel */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0">
              {heroImg ? (
                <img src={heroImg} alt="Clinic" className="w-full h-full object-cover object-center opacity-70" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#193866] to-[#0d1f3c]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F2744] via-[#0F2744]/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust Pillars Bar ───────────────────────────────────────────────────────

function TrustPillarsBar({ trustItems, archetype }: { trustItems: TrustItem[]; archetype: ArchetypeKey }) {
  if (trustItems.length === 0) return null;
  const p = PALETTE[archetype];
  const isPremium = archetype === "DENTAL_PREMIUM";
  const isSpecialist = archetype === "DENTAL_SPECIALIST";

  return (
    <section className={cn("border-y", isPremium ? "bg-white border-stone-200" : isSpecialist ? "bg-[#F2F6F9] border-slate-200" : "bg-slate-50 border-slate-200")}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200">
          {trustItems.slice(0, 4).map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl mb-1" style={{ backgroundColor: `${p.primary}12`, color: p.primary }}>
                <TrustIcon icon={item.icon} />
              </span>
              <p className="text-xl font-extrabold tracking-tight" style={{ color: p.dark }}>{item.value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Services ────────────────────────────────────────────────────────────────

const SERVICE_ICON_COLORS = [
  { bg: "#1B6FBF18", text: "#1B6FBF" },
  { bg: "#2A7D4F18", text: "#2A7D4F" },
  { bg: "#C9A96E22", text: "#C9A96E" },
  { bg: "#7B4FB318", text: "#7B4FB3" },
  { bg: "#D9534F18", text: "#D9534F" },
  { bg: "#4EA8E418", text: "#4EA8E4" },
];

function ServiceCards({ services, archetype }: { services: ServiceCard[]; archetype: ArchetypeKey }) {
  if (services.length === 0) return null;
  const p = PALETTE[archetype];
  const isPremium = archetype === "DENTAL_PREMIUM";

  return (
    <section className={cn("py-20 sm:py-28", isPremium ? p.bgAlt : p.bgAlt)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header — Ktabna style */}
        <div className="mb-12 sm:mb-16 text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: p.primary }}>
            What we offer
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: p.dark }}>
            {isPremium ? "Our Treatments" : "Our Services"}
          </h2>
        </div>

        <div className={cn(
          "grid gap-5",
          services.length === 1 ? "grid-cols-1 max-w-sm mx-auto" :
          services.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}>
          {services.map((s, i) => {
            const iconColor = SERVICE_ICON_COLORS[i % SERVICE_ICON_COLORS.length];
            return (
              <div
                key={i}
                className={cn(
                  "group rounded-2xl border p-7 transition-all hover:shadow-md",
                  isPremium ? "bg-[#FDFCF8] border-stone-200 hover:border-[#C9A96E]/40" : "bg-white border-slate-200 hover:border-[#1B6FBF]/30"
                )}
              >
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold transition-all group-hover:scale-110"
                  style={{ backgroundColor: iconColor.bg, color: iconColor.text }}
                >
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-[15px] font-bold mb-2" style={{ color: p.dark }}>{s.name}</h3>
                {s.description && (
                  <p className="text-sm leading-relaxed text-slate-600">{s.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Why Choose (DENTAL_CORE dark section) ───────────────────────────────────

function WhyChooseSection({ business, archetype }: { business: PreviewConfig["business"]; archetype: ArchetypeKey }) {
  if (archetype !== "DENTAL_CORE") return null;
  if (!business.rating) return null;

  const bullets = [
    business.rating ? `${business.rating} Google rating${business.reviewCount ? ` from ${business.reviewCount.toLocaleString()} reviews` : ""}` : null,
    "Online appointment booking available",
    "Phone and in-person consultations",
    `Serving patients in ${business.city}`,
  ].filter(Boolean) as string[];

  return (
    <section className="py-20 sm:py-28" style={{ backgroundColor: "#0f172a" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4EA8E4]">
              Why choose us
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              A clinic you can trust in {business.city}
            </h2>
            <p className="text-white/60 text-base leading-relaxed">
              Our patients choose us for the quality of care, the transparency of our process, and our commitment to your comfort.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl p-5" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "#1B6FBF33", color: "#4EA8E4" }}>✓</span>
                <span className="text-sm font-medium text-white/80">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Rating Spotlight (DENTAL_PREMIUM) ───────────────────────────────────────

function RatingSpotlight({ business, archetype }: { business: PreviewConfig["business"]; archetype: ArchetypeKey }) {
  if (archetype !== "DENTAL_PREMIUM") return null;
  if (!business.rating) return null;
  const ratingStr = formatRating(business.rating, business.reviewCount);

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Large number */}
          <div className="text-center lg:text-left shrink-0">
            <p className="text-[5rem] sm:text-[7rem] font-bold leading-none tracking-tight" style={{ color: "#0B2D5E" }}>
              {business.rating}
            </p>
            <span className="flex justify-center lg:justify-start mt-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={24} className={cn("fill-current", i <= Math.round(business.rating ?? 0) ? "text-[#C9A96E]" : "text-slate-200")} />
              ))}
            </span>
            {business.reviewCount && (
              <p className="mt-3 text-sm text-slate-500">{business.reviewCount.toLocaleString()} Google reviews</p>
            )}
          </div>
          {/* Divider */}
          <div className="hidden lg:block w-px h-32 bg-stone-200" />
          {/* Editorial text */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#C9A96E" }}>
              Our reputation
            </p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-6" style={{ color: "#0B2D5E" }}>
              Trusted by patients across {business.city}
            </h2>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              {ratingStr} on Google — a reflection of our commitment to patient experience and clinical excellence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Expertise Section (DENTAL_SPECIALIST) ───────────────────────────────────

function ExpertiseSection({ business, services, archetype }: { business: PreviewConfig["business"]; services: ServiceCard[]; archetype: ArchetypeKey }) {
  if (archetype !== "DENTAL_SPECIALIST") return null;

  const points = [
    business.rating ? `${business.rating} Google rating · ${business.reviewCount?.toLocaleString() ?? ""} reviews` : null,
    `Specialist ${business.category} in ${business.city}`,
    services.length > 0 ? `${services.length} specialist treatments available` : null,
    "Direct appointment booking",
  ].filter(Boolean) as string[];

  return (
    <section className="py-20 sm:py-28 bg-[#F2F6F9]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#2A7D4F" }}>
              Clinical expertise
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ color: "#0F2744" }}>
              Specialist care you can rely on
            </h2>
            <p className="text-base text-slate-600 leading-relaxed mb-8">
              We combine specialist expertise with a patient-first approach to deliver exceptional outcomes.
            </p>
            <ul className="space-y-4">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#2A7D4F" }}>✓</span>
                  <span className="text-sm text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Visual block */}
          <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: "#193866" }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Established</p>
            <p className="text-6xl font-bold text-white mb-2">{business.category.split(" ")[0]}</p>
            <p className="text-white/60 text-sm">specialist clinic</p>
            <p className="text-white/40 text-xs mt-2">{business.city}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Location Section ────────────────────────────────────────────────────────

function LocationSection({ location, business, archetype }: { location: PreviewConfig["location"]; business: PreviewConfig["business"]; archetype: ArchetypeKey }) {
  if (!location) return null;
  const p = PALETTE[archetype];
  const waHref = getWhatsAppHref(business.whatsapp);

  return (
    <section className={cn("py-20 sm:py-28", p.bgAlt)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: p.primary }}>
              Find us
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: p.dark }}>
              Visit our clinic
            </h2>
            <p className="text-base text-slate-600 leading-relaxed mb-10">
              We welcome patients from across {location.city} and the surrounding area.
            </p>

            <dl className="space-y-5">
              {location.address && (
                <div className="flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <MapPin size={18} style={{ color: p.primary }} />
                  </div>
                  <dd className="text-sm font-medium text-slate-800">{location.address}</dd>
                </div>
              )}
              {business.phone && (
                <div className="flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <Phone size={18} style={{ color: p.primary }} />
                  </div>
                  <dd>
                    <a href={`tel:${business.phone}`} className="text-sm font-medium text-slate-800 hover:underline">
                      {business.phone}
                    </a>
                  </dd>
                </div>
              )}
              {waHref && (
                <div className="flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <WaIcon className="w-[18px] h-[18px] text-[#25D366]" />
                  </div>
                  <dd>
                    <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-800 hover:text-[#25D366] transition-colors">
                      WhatsApp Us
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Map card */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-[4/3] flex items-center justify-center">
            {location.googleMapsUrl ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${p.primary}12` }}>
                  <MapPin size={28} style={{ color: p.primary }} />
                </div>
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: p.primary }}
                >
                  Open in Google Maps
                  <ArrowRight size={16} />
                </a>
                <p className="text-xs text-slate-400">{location.address}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <MapPin size={36} style={{ color: `${p.primary}66` }} />
                <p className="text-sm text-slate-500">{location.address}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Booking Band (CTA) ──────────────────────────────────────────────────────

function BookingBand({ primaryCTA, businessName, archetype }: {
  primaryCTA: PreviewConfig["hero"]["primaryCTA"];
  businessName: string;
  archetype: ArchetypeKey;
}) {
  const p = PALETTE[archetype];
  const isPremium = archetype === "DENTAL_PREMIUM";

  return (
    <section className="py-20 sm:py-28 text-center text-white" style={{ backgroundColor: p.darkSection }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          {isPremium ? `Book your consultation at ${businessName}` : `Ready to book an appointment?`}
        </h2>
        <p className="text-white/60 text-base mb-10 leading-relaxed">
          {isPremium
            ? "Experience premium dental care in a welcoming environment."
            : `${businessName} is ready to welcome you. Contact us to schedule your visit.`}
        </p>
        {primaryCTA.href && (
          <a
            href={primaryCTA.href}
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90"
            style={{ backgroundColor: isPremium ? p.accent : "#1B6FBF" }}
          >
            <Calendar size={18} />
            {primaryCTA.label}
          </a>
        )}
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer({ businessName }: { businessName: string }) {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
        </p>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          Concept preview by Diginest
        </span>
      </div>
    </footer>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function DentalPreviewPage({ config }: { config: PreviewConfig }) {
  const { hero, business, trustItems, services, location, archetype, logoUrl } = config;
  const a = archetype as ArchetypeKey;
  const showServices = services && services.length > 0;
  const showLocation = !!location;
  const showBookingBand = config.previewDepth === "STRONG" || config.previewDepth === "PREMIUM";

  return (
    <div className="min-h-screen text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">

      {/* ── DENTAL_CORE ─────────────────────────────────────────── */}
      {a === "DENTAL_CORE" && (
        <>
          <AnnouncementBar phone={business.phone} archetype={a} />
          <Navbar businessName={business.name} logoUrl={logoUrl} primaryCTA={hero.primaryCTA} archetype={a} />
          <CoreHero hero={hero} business={business} />
          <TrustPillarsBar trustItems={trustItems} archetype={a} />
          {showServices && <ServiceCards services={services} archetype={a} />}
          <WhyChooseSection business={business} archetype={a} />
          {showLocation && <LocationSection location={location} business={business} archetype={a} />}
          {showBookingBand && <BookingBand primaryCTA={hero.primaryCTA} businessName={business.name} archetype={a} />}
        </>
      )}

      {/* ── DENTAL_PREMIUM ──────────────────────────────────────── */}
      {a === "DENTAL_PREMIUM" && (
        <>
          <Navbar businessName={business.name} logoUrl={logoUrl} primaryCTA={hero.primaryCTA} archetype={a} />
          <PremiumHero hero={hero} business={business} />
          <TrustPillarsBar trustItems={trustItems} archetype={a} />
          {showServices && <ServiceCards services={services} archetype={a} />}
          <RatingSpotlight business={business} archetype={a} />
          {showLocation && <LocationSection location={location} business={business} archetype={a} />}
          {showBookingBand && <BookingBand primaryCTA={hero.primaryCTA} businessName={business.name} archetype={a} />}
        </>
      )}

      {/* ── DENTAL_SPECIALIST ───────────────────────────────────── */}
      {a === "DENTAL_SPECIALIST" && (
        <>
          <AnnouncementBar phone={business.phone} archetype={a} />
          <Navbar businessName={business.name} logoUrl={logoUrl} primaryCTA={hero.primaryCTA} archetype={a} />
          <SpecialistHero hero={hero} business={business} />
          <TrustPillarsBar trustItems={trustItems} archetype={a} />
          {showServices && <ServiceCards services={services} archetype={a} />}
          <ExpertiseSection business={business} services={services} archetype={a} />
          {showLocation && <LocationSection location={location} business={business} archetype={a} />}
          {showBookingBand && <BookingBand primaryCTA={hero.primaryCTA} businessName={business.name} archetype={a} />}
        </>
      )}

      <Footer businessName={business.name} />
    </div>
  );
}
