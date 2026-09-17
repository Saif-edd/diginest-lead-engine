import type { Lead } from "@/types/lead";
import type { OutreachChannel } from "@/types/outreach";
import type { PreviewRecord } from "@/types/preview";

export function getVerifiedInstagram(lead: Lead, preview?: PreviewRecord | null): string | null {
  if (lead.socialUrl && lead.socialUrl.toLowerCase().includes("instagram.com")) {
    return lead.socialUrl;
  }
  const profiles = preview?.verifiedFacts?.verifiedSocialProfiles;
  if (Array.isArray(profiles)) {
    const ig = profiles.find(p => p.toLowerCase().includes("instagram.com"));
    if (ig) return ig;
  }
  return null;
}

export function recommendOutreachChannel(lead: Lead, preview?: PreviewRecord | null): OutreachChannel {
  if (preview?.verifiedFacts?.whatsapp) return "WHATSAPP";
  if (lead.email) return "EMAIL";
  if (getVerifiedInstagram(lead, preview)) return "INSTAGRAM";
  return "NONE";
}
