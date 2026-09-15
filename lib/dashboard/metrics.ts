import type { Lead } from "../../types/lead";
import { objectiveStatusFor } from "../audit/state";

export function dashboardMetrics(leads: Lead[]) {
  return {
    total: leads.length,
    qualified: leads.filter((lead) => lead.qualificationStatus === "QUALIFIED").length,
    pendingObjective: leads.filter((lead) => lead.hasWebsite && ["PENDING", "QUEUED", "AUDITING", "FAILED", "BLOCKED"].includes(objectiveStatusFor(lead.audit))).length,
    pendingQualitative: leads.filter((lead) => lead.hasWebsite && lead.audit.qualitativeAuditStatus === "PENDING").length,
    actionablePriority: leads.filter((lead) => lead.qualificationStatus !== "HOLD" && lead.qualificationStatus !== "SKIP" && lead.qualificationStatus === "QUALIFIED" && lead.score.isFinal).length,
  };
}

export function qualifiedLeads(leads: Lead[]) {
  return leads.filter((lead) => lead.qualificationStatus === "QUALIFIED");
}
