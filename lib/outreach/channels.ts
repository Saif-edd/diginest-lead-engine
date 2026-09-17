import type { Lead } from "@/types/lead";
import type { OutreachChannel } from "@/types/outreach";
import type { PreviewRecord } from "@/types/preview";

export function recommendOutreachChannel(lead: Lead, preview?: PreviewRecord | null): OutreachChannel {
  if (preview?.verifiedFacts?.whatsapp) return "WHATSAPP";
  if (lead.email) return "EMAIL";
  if (lead.socialUrl && lead.socialUrl.toLowerCase().includes("instagram.com")) return "INSTAGRAM";
  return "NONE";
}
