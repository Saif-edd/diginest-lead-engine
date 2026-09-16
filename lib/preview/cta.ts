/**
 * CTA selector – picks the best factual CTA from verified lead/audit data.
 *
 * Priority:
 * 1. Booking URL (verified by audit)
 * 2. WhatsApp (verified by audit or lead)
 * 3. Phone (verified by audit or lead)
 * 4. NONE
 *
 * Returns primary CTA and optional secondary CTA.
 * Never creates fake links.
 */

import type { Lead } from "@/types/lead";
import type { PreviewCTA, CTAType } from "@/types/preview";

function buildWhatsAppHref(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}`;
}

function buildPhoneHref(number: string): string | null {
  const match = number.match(/\+?\d[\d\s-]{6,}/);
  if (!match) return null;
  return `tel:${match[0].replace(/\s/g, "")}`;
}

interface CTAResult {
  primaryCTA: PreviewCTA;
  secondaryCTA: PreviewCTA | null;
}

const NONE_CTA: PreviewCTA = { type: "NONE", label: "Contact us", href: null };

export function selectCTA(lead: Lead): CTAResult {
  const candidates: Array<{ type: CTAType; label: string; href: string }> = [];

  // 1. Booking
  if (lead.audit.bookingFound) {
    const bookingEvidence = lead.audit.bookingEvidence ?? [];
    // Try to extract a URL from evidence
    const bookingUrl = bookingEvidence
      .map((e) => {
        const match = e.match(/https?:\/\/[^\s]+/);
        return match ? match[0] : null;
      })
      .find(Boolean);

    candidates.push({
      type: "BOOKING",
      label: "Book an Appointment",
      href: bookingUrl ?? lead.website ?? "#",
    });
  }

  // 2. WhatsApp
  const whatsappNumber =
    lead.audit.whatsappFound
      ? // Prefer verified phone from evidence
        (lead.audit.whatsappEvidence?.[0] ?? lead.phone ?? null)
      : null;

  if (whatsappNumber) {
    const waHref = buildWhatsAppHref(whatsappNumber);
    if (waHref) {
      candidates.push({
        type: "WHATSAPP",
        label: "WhatsApp Us",
        href: waHref,
      });
    }
  }

  // 3. Phone
  const phoneNumber =
    lead.audit.phoneFound ? (lead.audit.phoneEvidence?.[0] ?? lead.phone ?? null) : lead.phone ?? null;

  if (phoneNumber) {
    const phHref = buildPhoneHref(phoneNumber);
    if (phHref) {
      candidates.push({
        type: "PHONE",
        label: "Call the Clinic",
        href: phHref,
      });
    }
  }

  if (candidates.length === 0) {
    return { primaryCTA: NONE_CTA, secondaryCTA: null };
  }

  const [primary, secondary = null] = candidates;

  return {
    primaryCTA: primary,
    secondaryCTA: secondary,
  };
}
