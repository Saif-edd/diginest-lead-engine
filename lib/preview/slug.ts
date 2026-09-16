/**
 * Slug generator for preview records.
 *
 * Produces a URL-safe, human-readable slug from a business name + city.
 * Deterministic: same inputs always produce the same slug.
 */
export function generateSlug(name: string, city: string, vertical = "dentist"): string {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      // strip diacritics
      .replace(/[\u0300-\u036f]/g, "")
      // replace non-alphanumeric (except space/hyphen) with space
      .replace(/[^a-z0-9 -]/g, " ")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const namePart = clean(name);
  const cityPart = clean(city);

  const base = cityPart ? `${namePart}-${cityPart}` : namePart;
  return `/${vertical}/${base}`;
}

/**
 * Returns just the path segment after the vertical prefix.
 * e.g. "/dentist/vision-dental-abu-dhabi" → "vision-dental-abu-dhabi"
 */
export function slugPathSegment(slug: string): string {
  const parts = slug.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? slug;
}
