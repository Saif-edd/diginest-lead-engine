/**
 * Script to generate real previews for qualified dental leads.
 *
 * Usage: tsx scripts/generate-previews.ts
 *
 * Reads QUALIFIED leads from the production workspace,
 * generates preview configs, and saves them as DRAFT.
 *
 * Then prints the public URLs for the ones marked READY.
 */

import "dotenv/config";
import { loadProductionWorkspace, upsertPreviewRecord, updatePreviewStatus } from "@/lib/persistence/db";
import { buildPreviewConfig } from "@/lib/preview/builder";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://diginest-lead-engine.vercel.app";

// Lead names to target for test previews
const TARGET_LEADS = [
  "vision dental",
  "icde",
  "abu dhabi dental",
  "brite",
  "diamond",
];

async function main() {
  console.log("\n=== Diginest Preview Generator ===\n");

  const workspace = await loadProductionWorkspace();
  const qualified = workspace.leads.filter(
    (lead) =>
      lead.qualificationStatus === "QUALIFIED" ||
      lead.manualDecision === "QUALIFY",
  );

  console.log(`Found ${qualified.length} qualified leads\n`);

  // Try to match target leads, fall back to top 5 by score
  let targets = qualified.filter((lead) =>
    TARGET_LEADS.some((name) => lead.name.toLowerCase().includes(name)),
  );

  if (targets.length < 3) {
    const extras = qualified
      .filter((lead) => !targets.includes(lead))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 5 - targets.length);
    targets = [...targets, ...extras];
  }

  targets = targets.slice(0, 5);
  console.log(`Targeting ${targets.length} leads for preview generation\n`);

  const results: Array<{ name: string; url: string; depth: string; archetype: string; status: string }> = [];

  for (const lead of targets) {
    process.stdout.write(`Generating preview for: ${lead.name}... `);

    if (!lead.audit.qualitativeResult) {
      console.log("SKIPPED (no qualitative result)");
      continue;
    }

    try {
      const config = await buildPreviewConfig(lead);
      if (!config) {
        console.log("SKIPPED (NONE depth or config build failed)");
        continue;
      }

      const previewId = `preview_${lead.leadId}`;
      const record = await upsertPreviewRecord({
        id: previewId,
        leadId: lead.leadId,
        slug: config.slug,
        status: "DRAFT",
        vertical: "DENTAL",
        archetype: config.archetype,
        archetypeConfidence: config.archetypeConfidence,
        previewDepth: config.previewDepth,
        configJson: config,
      });

      // Auto-mark as READY for test purposes
      await updatePreviewStatus(previewId, "READY");

      const slugSegment = config.slug.split("/").filter(Boolean).pop() ?? "";
      const url = `${BASE_URL}/dentist/${slugSegment}`;

      results.push({
        name: lead.name,
        url,
        depth: config.previewDepth,
        archetype: config.archetype,
        status: "READY",
      });

      console.log(`OK → ${url}`);
    } catch (error) {
      console.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n=== Preview URLs ===\n");
  for (const r of results) {
    console.log(`${r.name}`);
    console.log(`  Archetype: ${r.archetype} | Depth: ${r.depth}`);
    console.log(`  URL: ${r.url}`);
    console.log();
  }

  console.log(`Generated ${results.length}/${targets.length} previews successfully.\n`);
}

main().catch((error) => {
  console.error("Preview generation failed:", error);
  process.exit(1);
});
