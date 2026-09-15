import { leadIdentityInfo } from "../normalization";
import type { LeadIdentityReason } from "../normalization";
import type { Lead } from "../../types/lead";

export type DedupeReason = LeadIdentityReason;
export type DedupeReasonCounts = Record<DedupeReason, number>;

export const emptyDedupeReasonCounts = (): DedupeReasonCounts => ({
  place_id: 0,
  phone: 0,
  "website/domain": 0,
  "normalized name + address": 0,
});

export function deduplicateLeads(leads: Lead[]) {
  const seen = new Map<string, Lead>();
  const duplicates: Lead[] = [];
  const duplicateReasonCounts = emptyDedupeReasonCounts();
  for (const lead of leads) {
    const identity = leadIdentityInfo(lead);
    if (seen.has(identity.key)) {
      duplicates.push(lead);
      duplicateReasonCounts[identity.reason] += 1;
    } else seen.set(identity.key, lead);
  }
  return { unique: [...seen.values()], duplicates, duplicateReasonCounts };
}
