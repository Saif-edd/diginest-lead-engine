export const qualificationStatuses = [
  "PENDING WEBSITE AUDIT",
  "PENDING QUALITATIVE AUDIT",
  "REVIEW",
  "QUALIFIED",
  "HOLD",
  "SKIP",
] as const;
export type QualificationStatus = (typeof qualificationStatuses)[number];

export const workspaceModes = ["DEMO", "PRODUCTION"] as const;
export type WorkspaceMode = (typeof workspaceModes)[number];

export const manualDecisions = ["NONE", "QUALIFY", "HOLD", "SKIP"] as const;
export type ManualDecision = (typeof manualDecisions)[number];

export const priorities = [
  "P1 ULTRA",
  "P1 PREMIUM",
  "P2 STRONG",
  "P3 QUALIFIED",
  "P4 LOW",
] as const;
export type Priority = (typeof priorities)[number];

import type { AuditStatus, WebsiteAudit } from "./audit";
export type { AuditStatus, WebsiteAudit } from "./audit";

export const outreachStatuses = [
  "NOT STARTED",
  "PREVIEW QUEUED",
  "PREVIEW READY",
  "CONTACTED",
  "REPLIED",
  "POSITIVE",
  "CALL BOOKED",
  "WON",
  "LOST",
] as const;
export type OutreachStatus = (typeof outreachStatuses)[number];

export type PreviewRecommendation =
  "LIGHT PREVIEW" | "STRONG PREVIEW" | "PREMIUM PREVIEW";
export type ProblemSeverity = "CRITICAL" | "MAJOR" | "MINOR" | "NONE";

export interface RawImportedData {
  [key: string]: string | null;
}

export interface NoWebsiteOpportunity {
  strongBusinessPresence: number;
  commercialPotential: number;
  digitalGap: number;
}

export interface Reachability {
  hasPhone: boolean;
  hasEmail: boolean;
  hasSocial: boolean;
}

export interface PreviewPotential {
  realInformationAssets: number;
  clearServiceAngle: number;
  transformationOpportunity: number;
  personalizedCtaPotential: number;
}

export interface ScoreBreakdown {
  businessStrength: number;
  categoryContext: number;
  rating: number;
  reviewVolume: number;
  commercialProfile: number;
  opportunity: number;
  reachability: number;
  previewPotential: number;
  total: number;
  opportunityConfirmed: boolean;
  priority: Priority;
  isFinal: boolean;
  pendingComponents: string[];
}

export interface Lead {
  leadId: string;
  placeId?: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  category: string;
  rating?: number;
  totalRatings?: number;
  sourceFile: string;
  scrapeDate?: string;
  socialUrl?: string;
  hasWebsite: boolean;
  qualificationStatus: QualificationStatus;
  automaticQualification: Exclude<QualificationStatus, "HOLD" | "SKIP">;
  manualDecision: ManualDecision;
  audit: WebsiteAudit;
  noWebsiteOpportunity?: NoWebsiteOpportunity;
  reachability: Reachability;
  previewPotential: PreviewPotential;
  score: ScoreBreakdown;
  qualificationReason?: string;
  previewRecommendation?: PreviewRecommendation;
  previewAngle?: string;
  recommendedVariant?: string;
  outreachAngle?: string;
  personalizedHook?: string;
  outreachStatus: OutreachStatus;
  followupStage: 0 | 1 | 2 | 3;
  queueDate?: string;
  notes?: string;
  isDevelopmentSample?: boolean;
  rawImportedData: RawImportedData;
}

export type LeadField =
  | "name"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "category"
  | "rating"
  | "totalRatings"
  | "sourceFile"
  | "scrapeDate"
  | "placeId";
