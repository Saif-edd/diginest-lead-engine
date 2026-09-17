"use client";

import React, { useState, useEffect } from "react";
import { Lead } from "@/types/lead";
import { OutreachRecord, OutreachTimingState } from "@/types/outreach";
import { PreviewRecord } from "@/types/preview";
import { getWhatsAppDeepLink, getEmailMailto } from "@/lib/outreach/messages";
import { evaluateSendWindow } from "@/lib/outreach/timezones";

export function OutreachStudioView({ leads }: { leads: Lead[] }) {
  const [records, setRecords] = useState<Record<string, OutreachRecord>>({});
  const [previews, setPreviews] = useState<Record<string, PreviewRecord>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [outreachRes, previewRes] = await Promise.all([
        fetch("/api/outreach"),
        fetch("/api/preview")
      ]);
      const outreachData = await outreachRes.json();
      const previewData = await previewRes.json();
      
      if (outreachData.records) {
        const map: Record<string, OutreachRecord> = {};
        outreachData.records.forEach((r: OutreachRecord) => (map[r.leadId] = r));
        setRecords(map);
      }
      
      if (previewData.records) {
        const pMap: Record<string, PreviewRecord> = {};
        previewData.records.forEach((r: PreviewRecord) => (pMap[r.leadId] = r));
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
    return (
      (l.qualificationStatus === "QUALIFIED" || l.manualDecision === "QUALIFY") &&
      p?.workflowStatus === "READY_FOR_OUTREACH" &&
      p?.finalPreviewUrl &&
      (l.reachability.hasPhone || l.reachability.hasEmail || l.reachability.hasSocial)
    );
  });

  const handleInit = async (leadId: string) => {
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "initialize" }),
    });
    if (res.ok) fetchData();
  };

  const handleGenerate = async (leadId: string) => {
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    if (res.ok) fetchData();
  };

  const handleStatus = async (leadId: string, status: string) => {
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status }),
    });
    if (res.ok) fetchData();
  };

  // Metrics
  const totalReady = eligibleLeads.length;
  const totalContacted = Object.values(records).filter(r => r.status !== "NOT_STARTED" && r.status !== "READY").length;
  const totalReplies = Object.values(records).filter(r => ["REPLIED", "POSITIVE", "CALL_BOOKED", "WON"].includes(r.status)).length;
  const totalWon = Object.values(records).filter(r => r.status === "WON").length;

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">Sprint 3B</p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">Outreach Studio</h1>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow-sm border border-[#e5eaf0]">
          <div className="text-xs text-gray-500 font-bold uppercase">Ready</div>
          <div className="text-2xl font-bold">{totalReady}</div>
        </div>
        <div className="bg-white p-4 rounded shadow-sm border border-[#e5eaf0]">
          <div className="text-xs text-gray-500 font-bold uppercase">Contacted</div>
          <div className="text-2xl font-bold">{totalContacted}</div>
        </div>
        <div className="bg-white p-4 rounded shadow-sm border border-[#e5eaf0]">
          <div className="text-xs text-gray-500 font-bold uppercase">Replies</div>
          <div className="text-2xl font-bold">{totalReplies}</div>
        </div>
        <div className="bg-white p-4 rounded shadow-sm border border-[#e5eaf0]">
          <div className="text-xs text-gray-500 font-bold uppercase">Won</div>
          <div className="text-2xl font-bold text-emerald-600">{totalWon}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading outreach queue...</div>
      ) : (
        <div className="space-y-4">
          {eligibleLeads.map((lead) => {
            const rec = records[lead.leadId];
            if (!rec) {
              return (
                <div key={lead.leadId} className="border border-[#e5eaf0] p-4 rounded-xl bg-white shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-bold text-[#17243a]">{lead.name}</div>
                    <div className="text-sm text-gray-500">Ready for outreach but not initialized in queue.</div>
                  </div>
                  <button onClick={() => handleInit(lead.leadId)} className="bg-[#00aaca] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">
                    Initialize Lead
                  </button>
                </div>
              );
            }

            let timingState: OutreachTimingState = { status: "REVIEW_TIMEZONE", prospectLocalTime: null };
            if (rec.prospectTimezone) {
              let rule: any = "DEFAULT";
              if (rec.prospectTimezone.includes("Dubai")) rule = "MON_FRI";
              else if (rec.prospectTimezone.includes("Riyadh")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Qatar")) rule = "QATAR";
              else if (rec.prospectTimezone.includes("Kuwait") || rec.prospectTimezone.includes("Bahrain") || rec.prospectTimezone.includes("Muscat")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Casablanca")) rule = "MON_FRI";
              
              timingState = evaluateSendWindow(rec.prospectTimezone, rule);
            }

            return (
              <div key={lead.leadId} className="border border-[#e5eaf0] p-5 rounded-xl bg-white shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg text-[#17243a]">{lead.name}</div>
                    <div className="text-xs text-gray-500 flex gap-2 mt-1">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{rec.channel}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded uppercase">{rec.status}</span>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end">
                    <div className="text-xs text-gray-500 mb-1">{rec.prospectTimezone || "Timezone Unknown"}</div>
                    <div className="text-sm font-semibold">{timingState.prospectLocalTime || "--"}</div>
                    <div className={cn("text-[11px] font-bold px-2 py-0.5 rounded mt-1", 
                      timingState.status === "SEND_NOW" ? "bg-emerald-50 text-emerald-700" : 
                      timingState.status === "WAIT" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {timingState.status.replace("_", " ")}
                    </div>
                  </div>
                </div>

                {!rec.message ? (
                  <button onClick={() => handleGenerate(lead.leadId)} className="bg-[#17243a] text-white px-4 py-2 rounded-lg text-sm font-bold w-fit shadow-sm">
                    Generate Draft
                  </button>
                ) : (
                  <div className="bg-[#f5f7fa] p-4 rounded-lg text-sm text-[#27364b] whitespace-pre-wrap font-mono border border-[#dde3ea]">
                    {rec.subject && <div className="font-bold mb-3 pb-2 border-b border-[#dde3ea]">Subject: {rec.subject}</div>}
                    {rec.message}
                  </div>
                )}

                {rec.message && (
                  <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-[#e5eaf0]">
                    {rec.channel === "WHATSAPP" && lead.phone && (
                      <a href={getWhatsAppDeepLink(lead.phone, rec.message)} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-bold" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open WhatsApp
                      </a>
                    )}
                    {rec.channel === "EMAIL" && lead.email && (
                      <a href={getEmailMailto(lead.email, rec.subject || "", rec.message)} target="_blank" rel="noreferrer" className="bg-[#00aaca] text-white px-4 py-2 rounded-lg text-sm font-bold" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open Default Mail
                      </a>
                    )}
                    <a href="https://privateemail.com" target="_blank" rel="noreferrer" className="border border-[#dde3ea] text-[#526275] px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open Webmail
                    </a>
                    
                    <div className="flex-1"></div>

                    <button onClick={() => handleStatus(lead.leadId, "REPLIED")} className="bg-[#8b5cf6] text-white px-3 py-2 rounded-lg text-xs font-bold">
                      Replied
                    </button>
                    <button onClick={() => handleStatus(lead.leadId, "WON")} className="bg-[#10b981] text-white px-3 py-2 rounded-lg text-xs font-bold">
                      Won
                    </button>
                    <button onClick={() => handleStatus(lead.leadId, "LOST")} className="bg-[#ef4444] text-white px-3 py-2 rounded-lg text-xs font-bold">
                      Lost
                    </button>
                  </div>
                )}
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
