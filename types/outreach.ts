export const outreachChannels = ["WHATSAPP", "EMAIL", "INSTAGRAM", "NONE"] as const;
export type OutreachChannel = (typeof outreachChannels)[number];

export const outreachTimingStatuses = ["SEND_NOW", "WAIT", "REVIEW_TIMEZONE"] as const;
export type OutreachTimingStatus = (typeof outreachTimingStatuses)[number];

export const outreachRecordStatuses = [
  "NOT_STARTED",
  "READY",
  "CONTACTED",
  "REPLIED",
  "POSITIVE",
  "CALL_BOOKED",
  "WON",
  "LOST",
] as const;
export type OutreachRecordStatus = (typeof outreachRecordStatuses)[number];

export const copyVariants = ["AGGRESSIVE", "CURIOUS", "CLEAN"] as const;
export type CopyVariant = (typeof copyVariants)[number];

export interface OutreachRecord {
  id: string;
  leadId: string;
  previewId: string;
  finalPreviewUrl: string;
  channel: OutreachChannel;
  status: OutreachRecordStatus;
  
  // Messaging
  hook: string | null;
  message: string | null;
  subject: string | null;

  // Copy variant tracking (Sprint 3B.1)
  copyVariant: CopyVariant | null;
  subjectVariantId: string | null;
  messageVariantId: string | null;

  // Timezone persistence
  prospectTimezone: string | null; // IANA timezone
  timezoneSource: "DERIVED" | "MANUAL" | null;
  timezoneConfidence: "HIGH" | "MEDIUM" | "LOW" | null;

  // Follow-up state
  followUpCount: number;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  repliedAt: string | null;

  createdAt: string;
  updatedAt: string;
}


// Derived transient timing properties
export interface OutreachTimingState {
  prospectLocalTime: string | null; // e.g. "10:42 AM"
  status: OutreachTimingStatus;
  reason?: string;
  nextRecommendedSendTime?: string | null;
}
