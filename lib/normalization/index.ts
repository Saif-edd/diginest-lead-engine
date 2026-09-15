import {
  calculateLeadScore,
  automaticQualificationFor,
  effectiveQualificationFor,
} from "../scoring";
import type { Lead, LeadField, RawImportedData } from "../../types/lead";

export type CsvRow = Record<string, string | null>;
export type LeadIdentityReason =
  "place_id" | "phone" | "website/domain" | "normalized name + address";

const aliases: Record<LeadField, string[]> = {
  name: ["name", "business_name", "business name", "title"],
  address: ["address", "street", "location", "formatted_address"],
  phone: ["phone", "phone_number", "telephone", "mobile"],
  email: ["email", "email_address"],
  website: ["website", "url", "site", "web"],
  category: [
    "type",
    "category",
    "business_type",
    "business type",
    "categoryname",
  ],
  rating: ["rating", "stars", "google_rating", "totalscore"],
  totalRatings: [
    "total_ratings",
    "total ratings",
    "reviews",
    "review_count",
    "reviewscount",
    "user_ratings_total",
  ],
  sourceFile: ["source_file", "source file", "source"],
  scrapeDate: ["scrape_date", "scrape date", "date", "scraped_at"],
  placeId: ["place_id", "place id", "google_place_id"],
};

function cleanKey(key: string) {
  return key.trim().toLowerCase().replace(/[-]/g, "_");
}

function rawValue(row: CsvRow, field: LeadField): string {
  const found = Object.entries(row).find(
    ([key]) =>
      aliases[field].includes(cleanKey(key)) ||
      aliases[field].includes(key.trim().toLowerCase()),
  );
  return String(found?.[1] ?? "").trim();
}

function valueForKeys(row: CsvRow, keys: string[]): string {
  const found = Object.entries(row).find(
    ([key, value]) => keys.includes(cleanKey(key)) && value,
  );
  return String(found?.[1] ?? "").trim();
}

function numberValue(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizedWebsite(value: string): string | undefined {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return value
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\/$/, "");
  }
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
export { normalizedWebsite };

function inferSocial(row: CsvRow): string | undefined {
  const entry = Object.entries(row).find(
    ([key, value]) => /instagram|facebook|social|linkedin/i.test(key) && value,
  );
  return entry?.[1]?.trim() || undefined;
}

function inferPlaceId(row: CsvRow): string | undefined {
  const direct = rawValue(row, "placeId");
  if (direct) return direct;
  const mapsUrl = valueForKeys(row, ["url", "maps_url", "google_maps_url"]);
  const match = mapsUrl.match(/[?&]query_place_id=([^&]+)/i);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function normalizeRow(
  row: CsvRow,
  index: number,
  fileName = "import.csv",
): { lead?: Lead; error?: string } {
  const name = rawValue(row, "name");
  if (!name) return { error: `Row ${index + 1}: missing business name` };
  const address = [
    rawValue(row, "address"),
    valueForKeys(row, ["city"]),
    valueForKeys(row, ["state", "region"]),
    valueForKeys(row, ["countrycode", "country_code"]),
  ]
    .filter(Boolean)
    .join(", ");
  const website = rawValue(row, "website") || undefined;
  const phone = rawValue(row, "phone") || undefined;
  const email = rawValue(row, "email") || undefined;
  const category = rawValue(row, "category") || "Uncategorized";
  const rating = numberValue(rawValue(row, "rating"));
  const totalRatings = numberValue(rawValue(row, "totalRatings"));
  const socialUrl = inferSocial(row);
  const placeId = inferPlaceId(row);
  const hasWebsite = Boolean(normalizedWebsite(website ?? ""));
  const audit = {
    status: hasWebsite ? ("PENDING" as const) : ("NOT REQUIRED" as const),
    criticalProblems: [],
    majorProblems: [],
    minorProblems: [],
  };
  const noWebsiteOpportunity = hasWebsite
    ? undefined
    : {
        strongBusinessPresence: Math.min(8, (rating ?? 0) >= 4.5 ? 6 : 3),
        commercialPotential: Math.min(7, category !== "Uncategorized" ? 4 : 2),
        digitalGap: 5,
      };
  const reachability = {
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email),
    hasSocial: Boolean(socialUrl),
  };
  const previewPotential = {
    realInformationAssets: 3,
    clearServiceAngle: category !== "Uncategorized" ? 4 : 2,
    transformationOpportunity: 3,
    personalizedCtaPotential: 3,
  };
  const draft = {
    category,
    rating,
    totalRatings,
    hasWebsite,
    audit,
    noWebsiteOpportunity,
    reachability,
    previewPotential,
  } as const;
  const score = calculateLeadScore(draft);
  const automaticQualification = automaticQualificationFor({
    hasWebsite,
    audit,
    score,
  });
  const nowDate = new Date().toISOString().slice(0, 10);
  return {
    lead: {
      leadId:
        placeId ||
        `lead-${nowDate.replace(/-/g, "")}-${String(index + 1).padStart(4, "0")}`,
      placeId,
      name,
      address,
      phone,
      email,
      website,
      category,
      rating,
      totalRatings,
      sourceFile: rawValue(row, "sourceFile") || fileName,
      scrapeDate: rawValue(row, "scrapeDate") || undefined,
      socialUrl,
      hasWebsite,
      qualificationStatus: effectiveQualificationFor(
        "NONE",
        automaticQualification,
      ),
      automaticQualification,
      manualDecision: "NONE",
      audit,
      noWebsiteOpportunity,
      reachability,
      previewPotential,
      score,
      outreachStatus: "NOT STARTED",
      followupStage: 0,
      rawImportedData: { ...row },
    },
  };
}

export function normalizeRows(rows: CsvRow[], fileName = "import.csv") {
  const leads: Lead[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const result = normalizeRow(row, index, fileName);
    if (result.lead) leads.push(result.lead);
    else if (result.error) errors.push(result.error);
  });
  return { leads, errors };
}

export function leadIdentity(
  lead: Pick<Lead, "placeId" | "phone" | "website" | "name" | "address">,
) {
  return leadIdentityInfo(lead).key;
}

export function leadIdentityInfo(
  lead: Pick<Lead, "placeId" | "phone" | "website" | "name" | "address">,
): { key: string; reason: LeadIdentityReason } {
  if (lead.placeId)
    return {
      key: `place:${lead.placeId.trim().toLowerCase()}`,
      reason: "place_id",
    };
  const phone = normalizePhone(lead.phone ?? "");
  if (phone) return { key: `phone:${phone}`, reason: "phone" };
  const domain = normalizedWebsite(lead.website ?? "");
  if (domain) return { key: `domain:${domain}`, reason: "website/domain" };
  return {
    key: `fallback:${normalizeName(lead.name)}:${normalizeName(lead.address)}`,
    reason: "normalized name + address",
  };
}

export function preserveRawData(lead: Lead): RawImportedData {
  return { ...lead.rawImportedData };
}
