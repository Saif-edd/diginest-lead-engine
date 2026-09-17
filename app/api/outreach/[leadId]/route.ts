import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import { findOutreachByLeadId, upsertOutreachRecord, findPreviewByLeadId, findProductionLead } from "@/lib/persistence/db";
import type { OutreachChannel, OutreachRecordStatus, CopyVariant } from "@/types/outreach";
import { deriveTimezone } from "@/lib/outreach/timezones";
import { generateAllVariants, getWhatsAppDeepLink, getEmailMailto, type MessageContext } from "@/lib/outreach/messages";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> }
) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { leadId } = await context.params;
    if (!leadId)
      return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const body = (await request.json()) as {
      action: "initialize" | "generate" | "update_status" | "update_timezone";
      channel?: OutreachChannel;
      copyVariant?: CopyVariant;
      status?: OutreachRecordStatus;
      prospectTimezone?: string;
    };

    const lead = await findProductionLead(leadId);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const preview = await findPreviewByLeadId(leadId);
    if (!preview) return NextResponse.json({ error: "Preview not found" }, { status: 404 });

    let record = await findOutreachByLeadId(leadId);

    if (body.action === "initialize" && !record) {
      // Determine recommended channel
      let recommendedChannel: OutreachChannel = "INSTAGRAM";
      if (lead.reachability.hasPhone) recommendedChannel = "WHATSAPP";
      else if (lead.reachability.hasEmail) recommendedChannel = "EMAIL";

      const tz = deriveTimezone(lead.address || "");
      
      record = await upsertOutreachRecord({
        id: `outreach_${leadId}`,
        leadId,
        previewId: preview.id,
        finalPreviewUrl: preview.finalPreviewUrl || "",
        channel: recommendedChannel,
        status: "NOT_STARTED",
        hook: null,
        message: null,
        subject: null,
        copyVariant: null,
        subjectVariantId: null,
        messageVariantId: null,
        prospectTimezone: tz?.timezone || null,
        timezoneSource: tz ? "DERIVED" : null,
        timezoneConfidence: tz?.confidence || null,
        followUpCount: 0,
        lastContactedAt: null,
        nextFollowUpAt: null,
        repliedAt: null,
      });
      return NextResponse.json({ record });
    }

    if (!record) return NextResponse.json({ error: "Outreach record not initialized" }, { status: 400 });

    if (body.action === "generate") {
      const channel = body.channel || record.channel;
      const chosenVariant: CopyVariant = body.copyVariant ?? "CURIOUS";

      const qResult = lead.audit?.qualitativeResult;
      const ctx: MessageContext = {
        businessName: lead.name,
        city: lead.address,
        country: null,
        currentWebsite: lead.website ?? null,
        mainProblem: lead.outreachAngle
          ?? qResult?.mainProblem
          ?? lead.audit?.mainProblem
          ?? "website clarity",
        secondaryProblem: null,
        outreachAngle: lead.outreachAngle ?? null,
        rating: lead.rating ?? null,
        reviewCount: lead.totalRatings ?? null,
        finalPreviewUrl: preview.finalPreviewUrl || "",
        previewType: preview.archetype ?? null,
        verifiedServices: [],
        channel,
      };

      // Quality gate: finalPreviewUrl must exist
      if (!ctx.finalPreviewUrl) {
        return NextResponse.json(
          { error: "Cannot generate copy: preview URL not yet added. Add the final preview URL first." },
          { status: 422 }
        );
      }

      const allVariants = generateAllVariants(ctx, channel);
      const draft = allVariants[chosenVariant.toLowerCase() as keyof typeof allVariants];
      
      // draft might be the AllVariants object itself if lowercase key is wrong
      // use correct accessor:
      const chosenDraft =
        chosenVariant === "AGGRESSIVE" ? allVariants.aggressive
        : chosenVariant === "CURIOUS" ? allVariants.curious
        : allVariants.clean;

      record = await upsertOutreachRecord({
        ...record,
        channel,
        hook: chosenDraft.hook,
        message: chosenDraft.message,
        subject: chosenDraft.subject,
        copyVariant: chosenVariant,
        subjectVariantId: `${chosenVariant.toLowerCase()}-subject-v1`,
        messageVariantId: `${chosenVariant.toLowerCase()}-message-v1`,
        finalPreviewUrl: ctx.finalPreviewUrl,
      });

      // Also return all three variants for the UI to display
      return NextResponse.json({ record, allVariants });
    }

    if (body.action === "update_status") {
      if (body.status) record.status = body.status;
      if (body.status === "CONTACTED") {
        record.lastContactedAt = new Date().toISOString();
        if (record.followUpCount === 0) {
          const next = new Date();
          next.setDate(next.getDate() + 2);
          record.nextFollowUpAt = next.toISOString();
          record.followUpCount = 1;
        } else if (record.followUpCount === 1) {
          const next = new Date();
          next.setDate(next.getDate() + 4);
          record.nextFollowUpAt = next.toISOString();
          record.followUpCount = 2;
        } else {
          record.nextFollowUpAt = null;
        }
      }
      if (["REPLIED", "POSITIVE", "CALL_BOOKED", "WON", "LOST"].includes(body.status || "")) {
        record.repliedAt = new Date().toISOString();
        record.nextFollowUpAt = null;
      }
      record = await upsertOutreachRecord(record);
      return NextResponse.json({ record });
    }

    if (body.action === "update_timezone") {
      if (body.prospectTimezone) {
        record.prospectTimezone = body.prospectTimezone;
        record.timezoneSource = "MANUAL";
        record.timezoneConfidence = "HIGH";
        record = await upsertOutreachRecord(record);
      }
      return NextResponse.json({ record });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Outreach update failed" },
      { status: 503 },
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> }
) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { leadId } = await context.params;
  const lead = await findProductionLead(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const preview = await findPreviewByLeadId(leadId);
  if (!preview) return NextResponse.json({ error: "Preview not found" }, { status: 404 });

  const record = await findOutreachByLeadId(leadId);

  // Generate all three variants (preview only – do NOT auto-save)
  if (preview.finalPreviewUrl) {
    const qResult = lead.audit?.qualitativeResult;
    const ctx: MessageContext = {
      businessName: lead.name,
      city: lead.address,
      country: null,
      currentWebsite: lead.website ?? null,
      mainProblem: lead.outreachAngle ?? qResult?.mainProblem ?? lead.audit?.mainProblem ?? "website clarity",
      rating: lead.rating ?? null,
      reviewCount: lead.totalRatings ?? null,
      finalPreviewUrl: preview.finalPreviewUrl,
      previewType: preview.archetype ?? null,
    };

    const channel: OutreachChannel = record?.channel ?? (lead.reachability.hasPhone ? "WHATSAPP" : lead.reachability.hasEmail ? "EMAIL" : "INSTAGRAM");
    const allVariants = generateAllVariants(ctx, channel);
    return NextResponse.json({ record, allVariants, recommended: allVariants.recommended });
  }

  return NextResponse.json({ record, allVariants: null });
}

// Re-export helpers for the UI's direct-link generation
export { getWhatsAppDeepLink, getEmailMailto };
