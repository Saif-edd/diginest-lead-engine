"use client";

import React, { useState, useEffect } from "react";
import { Lead } from "@/types/lead";
import { OutreachRecord, OutreachTimingState, CopyVariant, OutreachChannel } from "@/types/outreach";
import { PreviewRecord } from "@/types/preview";
import { getWhatsAppDeepLink, getEmailMailto, type AllVariants } from "@/lib/outreach/messages";
import { evaluateSendWindow } from "@/lib/outreach/timezones";

type LeadId = string;

interface VariantCache {
  allVariants: AllVariants;
  variantsByChannel?: Record<OutreachChannel, AllVariants>;
  recommended: CopyVariant;
}

export function OutreachStudioView({ leads }: { leads: Lead[] }) {
  const [records, setRecords] = useState<Record<LeadId, OutreachRecord>>({});
  const [previews, setPreviews] = useState<Record<LeadId, PreviewRecord>>({});
  const [variantCache, setVariantCache] = useState<Record<LeadId, VariantCache>>({});
  const [selectedVariant, setSelectedVariant] = useState<Record<LeadId, CopyVariant>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<LeadId, boolean>>({});

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
    return (
      (l.qualificationStatus === "QUALIFIED" || l.manualDecision === "QUALIFY") &&
      p?.workflowStatus === "READY_FOR_OUTREACH" &&
      p?.finalPreviewUrl &&
      (l.reachability.hasPhone || l.reachability.hasEmail || l.reachability.hasSocial)
    );
  });

  const handleInit = async (leadId: LeadId) => {
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "initialize" }),
    });
    if (res.ok) fetchData();
  };

  const handleGenerate = async (leadId: LeadId, variant: CopyVariant) => {
    setGenerating((p) => ({ ...p, [leadId]: true }));
    try {
      const res = await fetch(`/api/outreach/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", copyVariant: variant }),
      });
      if (res.ok) {
        const data = await res.json() as { record: OutreachRecord; allVariants?: AllVariants; variantsByChannel?: Record<OutreachChannel, AllVariants> };
        setRecords((p) => ({ ...p, [leadId]: data.record }));
        if (data.allVariants) {
          setVariantCache((p) => ({ ...p, [leadId]: { allVariants: data.allVariants!, variantsByChannel: data.variantsByChannel, recommended: data.allVariants!.recommended } }));
        }
      }
    } finally {
      setGenerating((p) => ({ ...p, [leadId]: false }));
    }
  };

  const handleLoadVariants = async (leadId: LeadId) => {
    setGenerating((p) => ({ ...p, [leadId]: true }));
    try {
      const res = await fetch(`/api/outreach/${leadId}`);
      if (res.ok) {
        const data = await res.json() as { record: OutreachRecord | null; allVariants: AllVariants | null; variantsByChannel?: Record<OutreachChannel, AllVariants>; recommended: CopyVariant };
        if (data.allVariants) {
          setVariantCache((p) => ({ ...p, [leadId]: { allVariants: data.allVariants!, variantsByChannel: data.variantsByChannel, recommended: data.recommended } }));
          setSelectedVariant((p) => ({ ...p, [leadId]: data.recommended }));
        }
      }
    } finally {
      setGenerating((p) => ({ ...p, [leadId]: false }));
    }
  };

  const handleStatus = async (leadId: LeadId, status: string) => {
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status }),
    });
    if (res.ok) fetchData();
  };

  const handleManualTimezone = async (leadId: LeadId) => {
    const tz = prompt("Enter an IANA timezone (e.g. Asia/Dubai, Europe/London):");
    if (!tz) return;
    const res = await fetch(`/api/outreach/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_timezone", prospectTimezone: tz }),
    });
    if (res.ok) fetchData();
  };

  // Metrics
  const totalReady = eligibleLeads.length;
  const totalContacted = Object.values(records).filter(r => r.status !== "NOT_STARTED" && r.status !== "READY").length;
  const totalReplies = Object.values(records).filter(r => ["REPLIED", "POSITIVE", "CALL_BOOKED", "WON"].includes(r.status)).length;
  const totalWon = Object.values(records).filter(r => r.status === "WON").length;

  const channelMetrics = (ch: string) => {
    const list = Object.values(records).filter(r => r.channel === ch);
    return {
      contacted: list.filter(r => r.status !== "NOT_STARTED" && r.status !== "READY").length,
      replies: list.filter(r => ["REPLIED", "POSITIVE", "CALL_BOOKED", "WON"].includes(r.status)).length,
      positive: list.filter(r => ["POSITIVE", "CALL_BOOKED", "WON"].includes(r.status)).length,
    };
  };
  const waMetrics = channelMetrics("WHATSAPP");
  const emMetrics = channelMetrics("EMAIL");
  const igMetrics = channelMetrics("INSTAGRAM");

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">Sprint 3B</p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">Outreach Studio</h1>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          { label: "Ready", value: totalReady },
          { label: "Contacted", value: totalContacted },
          { label: "Replies", value: totalReplies },
          { label: "Won", value: totalWon, accent: true },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-white p-4 rounded shadow-sm border border-[#e5eaf0]">
            <div className="text-xs text-gray-500 font-bold uppercase">{label}</div>
            <div className={cn("text-2xl font-bold", accent && "text-emerald-600")}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "WhatsApp", m: waMetrics },
          { label: "Email", m: emMetrics },
          { label: "Instagram", m: igMetrics },
        ].map(({ label, m }) => (
          <div key={label} className="bg-white p-3 rounded shadow-sm border border-[#e5eaf0] text-xs flex justify-between">
            <span className="font-bold text-gray-700">{label}</span>
            <span className="text-gray-500">C: {m.contacted} | R: {m.replies} | P: {m.positive}</span>
          </div>
        ))}
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
              let rule: "FRI_SAT" | "SUN_THU" | "MON_FRI" | "QATAR" | "DEFAULT" = "DEFAULT";
              if (rec.prospectTimezone.includes("Dubai")) rule = "MON_FRI";
              else if (rec.prospectTimezone.includes("Riyadh")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Qatar")) rule = "QATAR";
              else if (rec.prospectTimezone.includes("Kuwait") || rec.prospectTimezone.includes("Bahrain") || rec.prospectTimezone.includes("Muscat")) rule = "FRI_SAT";
              else if (rec.prospectTimezone.includes("Casablanca")) rule = "MON_FRI";
              timingState = evaluateSendWindow(rec.prospectTimezone, rule);
            }

            const cache = variantCache[lead.leadId];
            const active = selectedVariant[lead.leadId] ?? rec.copyVariant ?? cache?.recommended ?? "CURIOUS";
            const activeDraft = cache?.allVariants
              ? (active === "AGGRESSIVE" ? cache.allVariants.aggressive
                : active === "CURIOUS"    ? cache.allVariants.curious
                : cache.allVariants.clean)
              : null;
            const displayMessage = activeDraft?.message ?? rec.message ?? null;
            const displaySubject = activeDraft?.subject ?? rec.subject ?? null;
            
            const preview = previews[lead.leadId];

            return (
              <div key={lead.leadId} className="border border-[#e5eaf0] p-5 rounded-xl bg-white shadow-sm flex flex-col gap-4">
                {/* Header row */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg text-[#17243a]">{lead.name}</div>
                    <div className="text-xs text-gray-500 flex gap-2 mt-1 flex-wrap">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{rec.channel}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded uppercase">{rec.status}</span>
                      {rec.copyVariant && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{rec.copyVariant}</span>}
                      {rec.followUpCount > 0 && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Follow-ups: {rec.followUpCount}</span>}
                      {preview?.finalPreviewUrl && (
                        <a href={preview.finalPreviewUrl} target="_blank" rel="noreferrer" className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded hover:underline">
                          Preview ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                      {rec.prospectTimezone || "Timezone Unknown"}
                      <button onClick={() => handleManualTimezone(lead.leadId)} className="text-blue-500 underline">Edit</button>
                    </div>
                    <div className="text-sm font-semibold">{timingState.prospectLocalTime || "--"}</div>
                    <div className={cn("text-[11px] font-bold px-2 py-0.5 rounded mt-1",
                      timingState.status === "SEND_NOW" ? "bg-emerald-50 text-emerald-700" :
                      timingState.status === "WAIT" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {timingState.status.replace("_", " ")}
                    </div>
                    {rec.nextFollowUpAt && <div className="text-[10px] text-gray-400 mt-1">Next: {new Date(rec.nextFollowUpAt).toLocaleDateString()}</div>}
                  </div>
                </div>

                {/* Variant selector */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Variant:</span>
                  {(["AGGRESSIVE", "CURIOUS", "CLEAN"] as CopyVariant[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedVariant((p) => ({ ...p, [lead.leadId]: v }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all",
                        active === v
                          ? v === "AGGRESSIVE" ? "bg-rose-600 text-white border-rose-600"
                          : v === "CURIOUS"    ? "bg-[#00aaca] text-white border-[#00aaca]"
                          : "bg-[#17243a] text-white border-[#17243a]"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {v === "AGGRESSIVE" ? "🔥 Aggressive" : v === "CURIOUS" ? "🎯 Curious" : "✦ Clean"}
                    </button>
                  ))}
                  {cache?.recommended && (
                    <span className="text-[10px] text-gray-400">Recommended: {cache.recommended}</span>
                  )}
                </div>

                {/* Copy display */}
                {!cache && !rec.message ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadVariants(lead.leadId)}
                      disabled={generating[lead.leadId]}
                      className="bg-[#00aaca] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
                    >
                      {generating[lead.leadId] ? "Loading..." : "Generate Drafts"}
                    </button>
                  </div>
                ) : !cache && rec.message ? (
                  <div className="flex flex-col gap-3">
                    <div className="bg-[#f5f7fa] p-4 rounded-lg text-sm text-[#27364b] whitespace-pre-wrap font-mono border border-[#dde3ea]">
                      {displaySubject && <div className="font-bold mb-3 pb-2 border-b border-[#dde3ea]">Subject: {displaySubject}</div>}
                      {displayMessage}
                    </div>
                    <button
                      onClick={() => handleLoadVariants(lead.leadId)}
                      disabled={generating[lead.leadId]}
                      className="text-[#00aaca] text-xs underline w-fit disabled:opacity-50"
                    >
                      {generating[lead.leadId] ? "Loading..." : "Load all 3 variants"}
                    </button>
                  </div>
                ) : cache ? (
                  <div className="flex flex-col gap-3">
                    {/* Quality flags */}
                    {activeDraft && activeDraft.qualityFlags.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {activeDraft.qualityFlags.map((f) => (
                          <span key={f} className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            ⚠ {f.replace(/_/g, " ")}
                          </span>
                        ))}
                        {!activeDraft.passed && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded text-xs font-bold">DRAFT NEEDS REVIEW</span>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    <div className="bg-[#f5f7fa] p-4 rounded-lg text-sm text-[#27364b] whitespace-pre-wrap font-mono border border-[#dde3ea]">
                      {displaySubject && <div className="font-bold mb-3 pb-2 border-b border-[#dde3ea]">Subject: {displaySubject}</div>}
                      {displayMessage}
                    </div>

                    {/* Save selected variant */}
                    <button
                      onClick={() => handleGenerate(lead.leadId, active)}
                      disabled={generating[lead.leadId]}
                      className="bg-[#17243a] text-white px-4 py-2 rounded-lg text-xs font-bold w-fit shadow-sm disabled:opacity-50"
                    >
                      {generating[lead.leadId] ? "Saving..." : `Use ${active} variant`}
                    </button>
                  </div>
                ) : null}

                {/* Action bar */}
                {displayMessage && (
                  <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-[#e5eaf0]">
                    {preview?.verifiedFacts?.whatsapp && (
                      <a href={getWhatsAppDeepLink(preview.verifiedFacts.whatsapp, (cache?.variantsByChannel?.WHATSAPP?.[active.toLowerCase() as "aggressive" | "curious" | "clean"]?.message as string) || (displayMessage as string)) || undefined} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-bold" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open WhatsApp
                      </a>
                    )}
                    {lead.email && (
                      <a href={getEmailMailto(lead.email, (cache?.variantsByChannel?.EMAIL?.[active.toLowerCase() as "aggressive" | "curious" | "clean"]?.subject as string) || (displaySubject as string) || `Website improvement for ${lead.name}`, (cache?.variantsByChannel?.EMAIL?.[active.toLowerCase() as "aggressive" | "curious" | "clean"]?.message as string) || (displayMessage as string)) || undefined} target="_blank" rel="noreferrer" className="bg-[#00aaca] text-white px-4 py-2 rounded-lg text-sm font-bold" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open Default Mail
                      </a>
                    )}
                    {lead.email && (
                      <a href="https://privateemail.com" target="_blank" rel="noreferrer" className="border border-[#dde3ea] text-[#526275] px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open Webmail
                      </a>
                    )}
                    {lead.socialUrl && (
                      <a href={lead.socialUrl} target="_blank" rel="noreferrer" className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold" onClick={() => handleStatus(lead.leadId, "CONTACTED")}>
                        Open Instagram
                      </a>
                    )}
                    {/* Copy buttons */}
                    {displaySubject && (
                      <button
                        onClick={() => navigator.clipboard.writeText(displaySubject)}
                        className="border border-[#dde3ea] text-[#526275] px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                      >
                        Copy Subject
                      </button>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(displayMessage)}
                      className="border border-[#dde3ea] text-[#526275] px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                    >
                      Copy Message
                    </button>

                    <div className="flex-1" />

                    <button onClick={() => handleStatus(lead.leadId, "REPLIED")} className="bg-[#8b5cf6] text-white px-3 py-2 rounded-lg text-xs font-bold">Replied</button>
                    <button onClick={() => handleStatus(lead.leadId, "POSITIVE")} className="bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Positive</button>
                    <button onClick={() => handleStatus(lead.leadId, "WON")} className="bg-[#10b981] text-white px-3 py-2 rounded-lg text-xs font-bold">Won</button>
                    <button onClick={() => handleStatus(lead.leadId, "LOST")} className="bg-[#ef4444] text-white px-3 py-2 rounded-lg text-xs font-bold">Lost</button>
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





