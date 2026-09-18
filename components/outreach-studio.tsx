"use client";

import React, { useState, useEffect } from "react";
import { Lead } from "@/types/lead";
import { OutreachRecord, OutreachTimingState } from "@/types/outreach";
import { PreviewRecord } from "@/types/preview";
import { getWhatsAppDeepLink, getEmailMailto, generateAllVariants } from "@/lib/outreach/messages";
import { getVerifiedInstagram } from "@/lib/outreach/channels";
import { evaluateSendWindow } from "@/lib/outreach/timezones";

type LeadId = string;

export function OutreachStudioView({ leads }: { leads: Lead[] }) {
  const [records, setRecords] = useState<Record<LeadId, OutreachRecord>>({});
  const [previews, setPreviews] = useState<Record<LeadId, PreviewRecord>>({});
  const [loading, setLoading] = useState(true);
  const [copiedIg, setCopiedIg] = useState<Record<LeadId, boolean>>({});

  const fetchData = async () => {
    try {
      const [outreachRes, previewRes] = await Promise.all([
        fetch("/api/outreach"),
        fetch("/api/preview")
      ]);
      const outreachData = await outreachRes.json();
      const previewData = await previewRes.json();
      
      if (outreachData.records) {
        const map: Record<LeadId, OutreachRecord> = {};
        (outreachData.records as OutreachRecord[]).forEach((r) => (map[r.leadId] = r));
        setRecords(map);
      }
      
      if (previewData.records) {
        const pMap: Record<LeadId, PreviewRecord> = {};
        (previewData.records as PreviewRecord[]).forEach((r) => (pMap[r.leadId] = r));
        setPreviews(pMap);
      }
    } catch (err) {
      console.error("Failed to load outreach studio data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const eligibleLeads = leads.filter((l) => {
    const p = previews[l.leadId];
    const isReady = (l.qualificationStatus === "QUALIFIED" || l.manualDecision === "QUALIFY") &&
      p?.workflowStatus === "READY_FOR_OUTREACH" &&
      p?.finalPreviewUrl;
      
    if (!isReady) return false;
    
    // Must be reachable via at least one channel
    return p?.verifiedFacts?.whatsapp || l.email || getVerifiedInstagram(l, p);
  });

  const handleInstagram = (leadId: LeadId, igUrl: string, message: string) => {
    navigator.clipboard.writeText(message);
    setCopiedIg((prev) => ({ ...prev, [leadId]: true }));
    setTimeout(() => setCopiedIg((prev) => ({ ...prev, [leadId]: false })), 3000);
    window.open(igUrl, "_blank");
  };

  return (
    <div className="p-6 max-w-[800px] mx-auto animate-fade-in space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">Sprint 3B</p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">Outreach Studio</h1>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading outreach queue...</div>
      ) : (
        <div className="space-y-4">
          {eligibleLeads.map((lead) => {
            const rec = records[lead.leadId];
            const preview = previews[lead.leadId];
            
            let timingState: OutreachTimingState = { status: "REVIEW_TIMEZONE", prospectLocalTime: null };
            if (rec?.prospectTimezone) {
              let rule: "FRI_SAT" | "SUN_THU" | "MON_FRI" | "QATAR" | "DEFAULT" = "DEFAULT";
              if (rec.prospectTimezone.includes("Dubai")) rule = "MON_FRI";
              else if (rec.prospectTimezone.includes("Riyadh")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Qatar")) rule = "QATAR";
              else if (rec.prospectTimezone.includes("Kuwait") || rec.prospectTimezone.includes("Bahrain") || rec.prospectTimezone.includes("Muscat")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Casablanca")) rule = "MON_FRI";
              timingState = evaluateSendWindow(rec.prospectTimezone, rule);
            }

            const ctx = {
              businessName: lead.name,
              city: "", // city and country not on Lead type directly
              country: "",
              currentWebsite: lead.website,
              mainProblem: preview?.verifiedFacts?.mainProblem || "trust signals are buried",
              rating: preview?.verifiedFacts?.googleRating,
              reviewCount: preview?.verifiedFacts?.reviewCount,
              finalPreviewUrl: preview?.finalPreviewUrl as string,
            };

            const igUrl = getVerifiedInstagram(lead, preview);
            const waNumber = preview?.verifiedFacts?.whatsapp;
            const hasEmail = lead.email;

            const waMsg = waNumber ? generateAllVariants(ctx, "WHATSAPP").aggressive.message : "";
            const igMsg = igUrl ? generateAllVariants(ctx, "INSTAGRAM").aggressive.message : "";
            const emailDraft = hasEmail ? generateAllVariants(ctx, "EMAIL").aggressive : null;

            return (
              <div key={lead.leadId} className="border border-[#e5eaf0] p-5 rounded-xl bg-white shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg text-[#17243a]">{lead.name}</div>
                    <a href={preview.finalPreviewUrl!} target="_blank" rel="noreferrer" className="text-sm text-teal-600 hover:underline">
                      Preview Link â†—
                    </a>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className={cn("text-[11px] font-bold px-2 py-0.5 rounded",
                      timingState.status === "SEND_NOW" ? "bg-emerald-50 text-emerald-700" :
                      timingState.status === "WAIT" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {timingState.status.replace("_", " ")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {waNumber && (
                    <a
                      href={getWhatsAppDeepLink(waNumber, waMsg) || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-bold flex-1 text-center"
                    >
                      WhatsApp
                    </a>
                  )}
                  {igUrl && (
                    <button
                      onClick={() => handleInstagram(lead.leadId, igUrl, igMsg)}
                      className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex-1 text-center flex flex-col items-center justify-center"
                    >
                      <span>Instagram</span>
                      {copiedIg[lead.leadId] && (
                        <span className="text-[10px] font-normal opacity-90 mt-0.5">DM copied — paste it in Instagram</span>
                      )}
                    </button>
                  )}
                  {hasEmail && emailDraft && (
                    <a
                      href={getEmailMailto(lead.email!, emailDraft.subject || "I rebuilt your homepage", emailDraft.message) || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#00aaca] text-white px-4 py-2 rounded-lg text-sm font-bold flex-1 text-center"
                    >
                      Email
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {eligibleLeads.length === 0 && (
            <div className="text-center p-12 text-gray-500 border border-dashed rounded-xl">
              No leads are READY_FOR_OUTREACH yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
