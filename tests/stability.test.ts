import { describe, expect, it, afterEach } from "vitest";
import { hasValidContactChannel, isValidEmail, isValidPhone } from "../lib/contact/validation";
import { isAuthorized } from "../lib/security/auth";
import { dashboardMetrics, qualifiedLeads } from "../lib/dashboard/metrics";
import { normalizeRows } from "../lib/normalization";

describe("contact validation", () => {
  it("accepts real channels and rejects placeholders", () => {
    expect(isValidPhone("+971 50 123 4567")).toBe(true);
    expect(isValidEmail("owner@example.com")).toBe(true);
    expect(hasValidContactChannel({ phone: "unknown", email: "-", socialUrl: "null" })).toBe(false);
    expect(hasValidContactChannel({ phone: "unknown", email: "owner@example.com" })).toBe(true);
  });
});

describe("production audit endpoint protection", () => {
  afterEach(() => { delete process.env.DIGINEST_ADMIN_TOKEN; });
  it("rejects audit actions without authentication", () => {
    process.env.DIGINEST_ADMIN_TOKEN = "test-token";
    expect(isAuthorized(new Request("http://localhost/api/audit"))).toBe(false);
    expect(isAuthorized(new Request("http://localhost/api/audit", { headers: { authorization: "Bearer test-token" } }))).toBe(true);
  });

});

describe("overview qualification consistency", () => {
  it("counts only final qualified output and excludes hold/skip", () => {
    const leads = normalizeRows([
      { name: "A", address: "A", phone: "1234567", rating: "4.8", total_ratings: "500" },
      { name: "B", address: "B", website: "https://example.com", rating: "4.8", total_ratings: "500" },
    ]).leads;
    const qualified = { ...leads[0], qualificationStatus: "QUALIFIED" as const, score: { ...leads[0].score, isFinal: true } };
    const held = { ...leads[1], qualificationStatus: "HOLD" as const };
    expect(dashboardMetrics([qualified, held]).qualified).toBe(1);
    expect(qualifiedLeads([qualified, held])).toHaveLength(1);
  });
});
