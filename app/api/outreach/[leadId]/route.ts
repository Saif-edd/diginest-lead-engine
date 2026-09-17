import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/security/auth";
import { findOutreachByLeadId, upsertOutreachRecord, findPreviewByLeadId, findProductionLead } from "@/lib/persistence/db";
import { OutreachRecord, OutreachChannel, OutreachRecordStatus } from "@/types/outreach";
import { deriveTimezone } from "@/lib/outreach/timezones";
import { generateHook, generateWhatsAppMessage, generateEmailSubject, generateEmailBody, generateInstagramDM } from "@/lib/outreach/messages";

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
      const ctx = {
        businessName: lead.name,
        city: lead.address,
        mainProblem: lead.outreachAngle || lead.score?.pendingComponents?.[0] || "some optimization issues",
        finalPreviewUrl: preview.finalPreviewUrl || "",
      };

      const hook = generateHook(ctx);
      let message = "";
      let subject = null;

      if (channel === "WHATSAPP") {
        message = generateWhatsAppMessage(ctx, hook);
      } else if (channel === "EMAIL") {
        subject = generateEmailSubject(ctx);
        message = generateEmailBody(ctx, hook);
      } else if (channel === "INSTAGRAM") {
        message = generateInstagramDM(ctx);
      }

      record = await upsertOutreachRecord({
        ...record,
        channel,
        hook,
        message,
        subject,
      });
      return NextResponse.json({ record });
    }

    if (body.action === "update_status") {
      if (body.status) record.status = body.status;
      if (body.status === "CONTACTED") {
        record.lastContactedAt = new Date().toISOString();
        if (record.followUpCount === 0) {
          // Follow up 1 in 2 days
          const next = new Date();
          next.setDate(next.getDate() + 2);
          record.nextFollowUpAt = next.toISOString();
          record.followUpCount = 1;
        } else if (record.followUpCount === 1) {
          // Follow up 2 in 4 days
          const next = new Date();
          next.setDate(next.getDate() + 4);
          record.nextFollowUpAt = next.toISOString();
          record.followUpCount = 2;
        } else {
          // Max 2 follow ups
          record.nextFollowUpAt = null;
        }
      }
      if (["REPLIED", "POSITIVE", "CALL_BOOKED", "WON", "LOST"].includes(body.status || "")) {
        record.repliedAt = new Date().toISOString();
        record.nextFollowUpAt = null; // stop further follow-ups
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
