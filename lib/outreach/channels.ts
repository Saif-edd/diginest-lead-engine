import type { Lead } from "@/types/lead";
import type { OutreachChannel } from "@/types/outreach";

export function recommendOutreachChannel(lead: Lead): OutreachChannel {
  if (lead.email) return "EMAIL";
  if (lead.socialUrl) return "INSTAGRAM";
  if (lead.phone) return "WHATSAPP";
  return "INSTAGRAM";
}