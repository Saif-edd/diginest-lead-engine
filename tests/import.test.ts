import { describe, expect, it } from "vitest";
import { deduplicateLeads } from "../lib/dedupe";
import { parseCsv } from "../lib/import/csv";
import { leadIdentity, normalizeRows } from "../lib/normalization";

describe("csv ingestion", () => {
  it("parses quoted values and preserves rows", () => {
    const rows = parseCsv(
      'name,address,phone\n"A, B","1 Main St",+1 555 0100\n',
    );
    expect(rows).toEqual([
      { name: "A, B", address: "1 Main St", phone: "+1 555 0100" },
    ]);
  });

  it("normalizes missing fields without dropping raw data", () => {
    const { leads, errors } = normalizeRows(
      [
        {
          name: "Sample Clinic",
          type: "Clinic",
          rating: "4.6",
          total_ratings: "22",
        },
      ],
      "sample.csv",
    );
    expect(errors).toHaveLength(0);
    expect(leads[0].leadId).toMatch(/^lead-/);
    expect(leads[0].hasWebsite).toBe(false);
    expect(leads[0].rawImportedData.type).toBe("Clinic");
  });

  it("deduplicates by place id, phone, domain, then fallback", () => {
    const rows = normalizeRows([
      { name: "One", address: "A", place_id: "place-1", phone: "111" },
      {
        name: "One duplicate",
        address: "B",
        place_id: "place-1",
        phone: "222",
      },
      { name: "Two", address: "B", phone: "333" },
      { name: "Two duplicate", address: "C", phone: "333" },
      { name: "Three", address: "C", website: "https://www.example.com" },
      { name: "Three duplicate", address: "D", website: "example.com/" },
    ]).leads;
    const result = deduplicateLeads(rows);
    expect(result.unique).toHaveLength(3);
    expect(result.duplicates).toHaveLength(3);
    expect(result.duplicateReasonCounts).toEqual({
      place_id: 1,
      phone: 1,
      "website/domain": 1,
      "normalized name + address": 0,
    });
    expect(leadIdentity(result.unique[0])).toBe("place:place-1");
  });
});
