"use client";

import type { PreviewConfig, TrustItem, ServiceCard } from "@/types/preview";
import { Star, Phone, MapPin, Calendar, CheckCircle2, Stethoscope, Clock, ShieldCheck, ChevronRight } from "lucide-react";

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function TrustIcon({ icon }: { icon?: string }) {
  if (icon === "star") return <Star className="fill-current text-yellow-400" size={24} />;
  if (icon === "phone") return <Phone size={24} />;
  if (icon === "location") return <MapPin size={24} />;
  if (icon === "calendar") return <Calendar size={24} />;
  if (icon === "whatsapp") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" stroke="none">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    );
  }
  return <ShieldCheck size={24} />;
}

function TopContactBar({ phone, location }: { phone: string | null; location?: PreviewConfig["location"] }) {
  return (
    <div className="hidden bg-[#0A1628] px-6 py-2.5 text-[11.5px] font-medium tracking-wide text-slate-300 sm:flex justify-between items-center">
      <div className="flex gap-8 max-w-7xl mx-auto w-full px-2">
        {location?.address && (
          <span className="flex items-center gap-2 text-slate-200">
            <MapPin size={13} className="text-blue-400" /> {location.address.split(',')[0]}
          </span>
        )}
        <div className="ml-auto">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 font-semibold text-white hover:text-blue-300 transition-colors">
              <Phone size={13} className="text-blue-400" /> {phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ businessName, primaryCTA, logoUrl }: { businessName: string; primaryCTA: PreviewConfig["hero"]["primaryCTA"]; logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="h-11 w-auto object-contain" />
          ) : (
            <span className="text-[19px] font-bold tracking-tight text-[#0A1628] leading-tight max-w-[200px] sm:max-w-none">{businessName}</span>
          )}
        </div>
        {primaryCTA.href && (
          <a
            href={primaryCTA.href}
            className="hidden rounded-full bg-blue-600 px-7 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow sm:block"
          >
            {primaryCTA.label}
          </a>
        )}
      </div>
    </header>
  );
}

function Hero({ hero, archetype }: { hero: PreviewConfig["hero"]; archetype: string }) {
  const isPremium = archetype === "DENTAL_PREMIUM";
  const isSpecialist = archetype === "DENTAL_SPECIALIST";

  return (
    <section className="relative overflow-hidden bg-white pt-16 sm:pt-24 lg:pt-32 pb-20 lg:pb-36">
      <div className="mx-auto max-w-7xl px-6 lg:flex lg:items-center lg:gap-16 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0">
          <div className="mb-8 flex items-center gap-3">
            <span className="rounded-full bg-blue-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700 ring-1 ring-inset ring-blue-600/20">
              {hero.eyebrow}
            </span>
          </div>
          <h1
            className={cn(
              "text-4xl font-extrabold tracking-tight text-[#0A1628] sm:text-[3.5rem] sm:leading-[1.1]",
              isPremium && "font-serif font-medium tracking-normal text-[#0A1628]",
              isSpecialist && "text-blue-950"
            )}
          >
            {hero.headline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl">
            {hero.subheadline}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            {hero.primaryCTA.href && (
              <a
                href={hero.primaryCTA.href}
                className="rounded-full bg-blue-600 px-8 py-3.5 text-[14px] font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {hero.primaryCTA.label}
              </a>
            )}
            {hero.secondaryCTA?.href && (
              <a
                href={hero.secondaryCTA.href}
                className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-3.5 text-[14px] font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                {hero.secondaryCTA.label}
                <ChevronRight size={16} className="text-slate-400 transition-transform group-hover:translate-x-1" />
              </a>
            )}
          </div>
        </div>
        <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-grow">
          {hero.heroImageUrl ? (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-slate-900/5">
              <img src={hero.heroImageUrl} alt="Clinic interior" className="h-full w-full object-cover object-center" />
            </div>
          ) : (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-slate-900/5 relative flex items-center justify-center bg-slate-50">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-slate-50 to-white" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TrustStrip({ items }: { items: TrustItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-8 text-center sm:p-10 transition-colors hover:bg-slate-50/50">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <TrustIcon icon={item.icon} />
              </span>
              <p className="text-2xl font-extrabold tracking-tight text-[#0A1628]">{item.value}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Services({ services }: { services: ServiceCard[] }) {
  return (
    <section className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-600">What we offer</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0A1628] sm:text-4xl">Premium Dental Services</h2>
          <p className="mt-4 text-lg text-slate-600">Comprehensive care tailored to your unique smile, utilizing the latest in modern dental technology.</p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:max-w-none lg:grid-cols-3">
          {services.map((s, i) => (
            <div key={i} className="group relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-600/20 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#0A1628]">{s.name}</h3>
              {s.description ? (
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{s.description}</p>
              ) : (
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">Professional {s.name.toLowerCase()} treatments provided by our expert team.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reputation({ business }: { business: PreviewConfig["business"] }) {
  if (!business.rating || !business.reviewCount) return null;
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-600">Our standard</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0A1628] sm:text-4xl">Why choose our clinic</h2>
          <p className="mt-4 text-lg text-slate-600">
            We believe in transparent and high-quality dentistry. Every treatment is designed with your comfort in mind.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-1 lg:gap-y-16 mx-auto">
            <div className="relative pl-16">
              <dt className="text-base font-bold text-[#0A1628]">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <Star className="h-6 w-6 text-yellow-400 fill-current" aria-hidden="true" />
                </div>
                Trusted & Verified
              </dt>
              <dd className="mt-2 text-base leading-7 text-slate-600">Rated {business.rating} stars by over {business.reviewCount} satisfied patients in {business.city}.</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Location({ location, phone, whatsapp }: { location: PreviewConfig["location"]; phone: string | null; whatsapp: string | null }) {
  if (!location) return null;
  return (
    <section className="bg-slate-50 py-24 sm:py-32 border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-16 lg:max-w-none lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-600">Find Us</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0A1628] sm:text-4xl">Our Location</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              We are conveniently located in {location.city}. Reach out to us or drop by for a consultation.
            </p>
            <dl className="mt-10 space-y-6 text-base leading-7 text-slate-600">
              {location.address && (
                <div className="flex gap-x-4">
                  <dt className="flex-none">
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </dt>
                  <dd className="font-medium text-[#0A1628]">{location.address}</dd>
                </div>
              )}
              {phone && (
                <div className="flex gap-x-4">
                  <dt className="flex-none">
                    <Phone className="h-6 w-6 text-blue-600" />
                  </dt>
                  <dd>
                    <a href={`tel:${phone}`} className="font-medium text-[#0A1628] hover:text-blue-600 transition-colors">
                      {phone}
                    </a>
                  </dd>
                </div>
              )}
              {whatsapp && (
                <div className="flex gap-x-4">
                  <dt className="flex-none">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" stroke="none">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                  </dt>
                  <dd>
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="font-medium text-[#0A1628] hover:text-[#25D366] transition-colors">
                      WhatsApp Us
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {location.googleMapsUrl && (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-50/50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-sm">
                  <MapPin size={32} />
                </div>
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-6 py-2.5 text-[13px] font-bold text-[#0A1628] shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:shadow"
                >
                  Open in Google Maps &rarr;
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BookingCTA({ primaryCTA, businessName }: { primaryCTA: PreviewConfig["hero"]["primaryCTA"]; businessName: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0A1628] px-6 py-24 text-center sm:py-32 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to transform your smile?</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-300">
          Book your consultation at {businessName} today and experience premium dental care.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {primaryCTA.href && (
            <a
              href={primaryCTA.href}
              className="rounded-full bg-blue-600 px-8 py-3.5 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {primaryCTA.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer({ businessName }: { businessName: string }) {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex justify-center space-x-6 md:order-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Concept preview by Diginest</span>
        </div>
        <div className="mt-8 md:order-1 md:mt-0">
          <p className="text-center text-[13px] leading-5 text-slate-500">
            &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function DentalPreviewPage({
  config,
}: {
  config: PreviewConfig;
}) {
  const { hero, business, trustItems, services, location, sections, archetype, logoUrl } = config;

  const showServices = sections.includes("services") && services && services.length > 0;
  const showLocation = sections.includes("location");
  const showFinalCTA = config.previewDepth === "STRONG" || config.previewDepth === "PREMIUM";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <TopContactBar phone={business.phone} location={location} />
      <Header businessName={business.name} primaryCTA={hero.primaryCTA} logoUrl={logoUrl} />
      
      <Hero hero={hero} archetype={archetype} />
      <TrustStrip items={trustItems} />
      
      {showServices && <Services services={services} />}
      
      <Reputation business={business} />
      
      {showLocation && (
        <Location
          location={location}
          phone={business.phone}
          whatsapp={business.whatsapp}
        />
      )}
      
      {showFinalCTA && (
        <BookingCTA
          primaryCTA={hero.primaryCTA}
          businessName={business.name}
        />
      )}
      
      <Footer businessName={business.name} />
    </div>
  );
}
