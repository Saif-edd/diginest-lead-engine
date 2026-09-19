"use client";

import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Globe2,
  Inbox,
  LayoutDashboard,
  Link,
  ListFilter,
  Mail,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WebsiteAudit } from "@/types/audit";
import { transitionAuditStatus } from "@/lib/audit/state";
import { qualitativeStatusFor, transitionQualitativeStatus } from "@/lib/qualitative/state";
import { applyQualitativeResultToLead } from "@/lib/qualitative/apply";
import { qualitativeIdempotencyKey } from "@/lib/qualitative/idempotency";
import type { QualitativeResult } from "@/types/qualitative";
import { deduplicateLeads, type DedupeReasonCounts } from "@/lib/dedupe";
import { parseCsv } from "@/lib/import/csv";
import { normalizeRows } from "@/lib/normalization";
import {
  automaticQualificationFor,
  calculateLeadScore,
  effectiveQualificationFor,
} from "@/lib/scoring";
import { sampleLeads } from "@/lib/data/sample-leads";
import type {
  Lead,
  LeadField,
  ManualDecision,
  QualificationStatus,
  WorkspaceMode,
} from "@/types/lead";
import type { ImportMode, ImportReport } from "@/types/import";
import { OutreachStudioView } from "./outreach-studio";

type ViewName =
  | "Overview"
  | "Leads"
  | "Website Audit"
  | "Qualified"
  | "Preview Studio"
  | "Outreach"
  | "Settings";
type SortKey =
  | "name"
  | "category"
  | "rating"
  | "totalRatings"
  | "total"
  | "qualificationStatus"
  | "outreachStatus";
type ColumnKey =
  | "business"
  | "category"
  | "rating"
  | "website"
  | "score"
  | "status"
  | "priority"
  | "audit"
  | "outreach";

const navItems: {
  label: ViewName;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Leads", icon: Users },
  { label: "Website Audit", icon: Globe2 },
  { label: "Qualified", icon: ShieldCheck },
  { label: "Preview Studio", icon: Sparkles },
  { label: "Outreach", icon: Mail },
  { label: "Settings", icon: Settings2 },
];

const columnLabels: Record<ColumnKey, string> = {
  business: "Business",
  category: "Category",
  rating: "Rating",
  website: "Website",
  score: "Score",
  status: "Status",
  priority: "Priority",
  audit: "Audit",
  outreach: "Outreach",
};

const defaultColumns: Record<ColumnKey, boolean> = {
  business: true,
  category: true,
  rating: true,
  website: true,
  score: true,
  status: true,
  priority: true,
  audit: false,
  outreach: false,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function formatRating(value?: number) {
  return value == null ? "—" : value.toFixed(1);
}
function formatReviews(value?: number) {
  return value == null ? "—" : value.toLocaleString();
}
function statusTone(value: string) {
  if (
    value === "QUALIFIED" ||
    value === "POSITIVE" ||
    value === "WON" ||
    value === "COMPLETE"
  )
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (
    value === "HOLD" ||
    value === "REVIEW" ||
    value === "PENDING WEBSITE AUDIT" ||
    value === "PENDING QUALITATIVE AUDIT" ||
    value === "PENDING" ||
    value === "PREVIEW QUEUED" ||
    value === "QUEUED"
  )
    return "bg-amber-50 text-amber-700 border-amber-100";
  if (value === "SKIP" || value === "LOST")
    return "bg-slate-100 text-slate-500 border-slate-200";
  if (
    value === "CONTACTED" ||
    value === "CALL BOOKED" ||
    value === "PREVIEW READY" ||
    value === "AUDITING" ||
    value === "ANALYZING"
  )
    return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (value === "FAILED" || value === "BLOCKED")
    return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-slate-50 text-slate-600 border-slate-200";
}
function priorityTone(value: string) {
  if (value === "P1 ULTRA")
    return "bg-violet-50 text-violet-700 border-violet-100";
  if (value === "P1 PREMIUM")
    return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (value === "P2 STRONG") return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (value === "P3 QUALIFIED") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-slate-100 text-slate-500 border-slate-200";
}
function StatusPill({
  value,
  compact = false,
}: {
  value: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[.06em]",
        compact && "px-1.5 py-0.5 text-[9px]",
        statusTone(value),
      )}
    >
      {value}
    </span>
  );
}
function PriorityPill({
  value,
  provisional = false,
}: {
  value: string;
  provisional?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold tracking-[.04em]",
        priorityTone(value),
      )}
    >
      {value
        .replace("P1 ", "P1 · ")
        .replace("P2 ", "P2 · ")
        .replace("P3 ", "P3 · ")
        .replace("P4 ", "P4 · ")}
      {provisional && (
        <span className="rounded bg-white/70 px-1 py-0.5 text-[8px] uppercase tracking-[.06em] opacity-80">
          Prelim
        </span>
      )}
    </span>
  );
}
function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faff] text-xs font-bold text-[#008ca9]">
      {initials}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: typeof Users;
  tone?: "cyan" | "violet" | "amber" | "green";
}) {
  const toneClass = {
    cyan: "bg-cyan-50 text-cyan-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className="rounded-xl border border-[#e5eaf0] bg-white p-4 shadow-[0_2px_8px_rgba(15,35,58,.025)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#718096]">
            {label}
          </p>
          <p className="mt-2 text-[26px] font-bold leading-none tracking-[-.04em] text-[#17243a]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            toneClass,
          )}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
      </div>
      {detail && <p className="mt-3 text-[11px] text-[#8793a4]">{detail}</p>}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[17px] font-bold tracking-[-.025em] text-[#17243a]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function OverviewView({
  leads,
  onViewLeads,
  onOpenLead,
}: {
  leads: Lead[];
  onViewLeads: () => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
  const stats = useMemo(
    () => ({
      total: leads.length,
      withWebsite: leads.filter((lead) => lead.hasWebsite).length,
      noWebsite: leads.filter((lead) => !lead.hasWebsite).length,
      qualified: leads.filter(
        (lead) => lead.qualificationStatus === "QUALIFIED",
      ).length,
      pendingObjective: leads.filter(
        (lead) => lead.qualificationStatus === "PENDING WEBSITE AUDIT",
      ).length,
      pendingQualitative: leads.filter((lead) => lead.qualificationStatus === "PENDING QUALITATIVE AUDIT").length,
      hold: leads.filter((lead) => lead.qualificationStatus === "HOLD").length,
      skip: leads.filter((lead) => lead.qualificationStatus === "SKIP").length,
      p1: leads.filter((lead) => lead.score.isFinal && !["HOLD", "SKIP"].includes(lead.qualificationStatus) && ["P1 ULTRA", "P1 PREMIUM"].includes(lead.score.priority)).length,
      p2: leads.filter((lead) => lead.score.isFinal && !["HOLD", "SKIP"].includes(lead.qualificationStatus) && lead.score.priority === "P2 STRONG").length,
      p3: leads.filter((lead) => lead.score.isFinal && !["HOLD", "SKIP"].includes(lead.qualificationStatus) && lead.score.priority === "P3 QUALIFIED").length,
      p4: leads.filter((lead) => lead.score.isFinal && !["HOLD", "SKIP"].includes(lead.qualificationStatus) && lead.score.priority === "P4 LOW").length,
      contacted: leads.filter((lead) =>
        ["CONTACTED", "REPLIED", "POSITIVE", "CALL BOOKED", "WON"].includes(
          lead.outreachStatus,
        ),
      ).length,
      positive: leads.filter((lead) =>
        ["POSITIVE", "CALL BOOKED", "WON"].includes(lead.outreachStatus),
      ).length,
      calls: leads.filter((lead) =>
        ["CALL BOOKED", "WON"].includes(lead.outreachStatus),
      ).length,
      won: leads.filter((lead) => lead.outreachStatus === "WON").length,
    }),
    [leads],
  );
  const queue = leads
    .filter(
      (lead) =>
        lead.qualificationStatus === "QUALIFIED" ||
        lead.qualificationStatus === "PENDING WEBSITE AUDIT" ||
        lead.qualificationStatus === "PENDING QUALITATIVE AUDIT",
    )
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 5);
  const priorityTotal = Math.max(1, stats.p1 + stats.p2 + stats.p3 + stats.p4);
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">
            {greeting}, team <span className="text-[#00bce3]">✦</span>
          </h1>
          <h1 className="hidden text-[27px] font-bold tracking-[-.045em] text-[#17243a]">
            Good morning, team <span className="text-[#00bce3]">✦</span>
          </h1>
          <p className="mt-1 text-sm text-[#718096]">
            Here&apos;s how your lead engine is moving today.
          </p>
        </div>
        <button
          onClick={onViewLeads}
          className="hidden items-center gap-2 rounded-lg bg-[#0a1628] px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#10223b] sm:flex"
        >
          <ListFilter size={15} /> Review lead queue
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Total leads"
          value={stats.total}
          detail="Across all sources"
          icon={Users}
        />
        <MetricCard
          label="With website"
          value={stats.withWebsite}
          detail={`${Math.round((stats.withWebsite / Math.max(1, stats.total)) * 100)}% of total leads`}
          icon={Globe2}
          tone="violet"
        />
        <MetricCard
          label="No website"
          value={stats.noWebsite}
          detail="Reviewable opportunity"
          icon={Building2}
          tone="amber"
        />
        <MetricCard
          label="Qualified"
          value={stats.qualified}
          detail={`${stats.pendingObjective} objective · ${stats.pendingQualitative} qualitative pending`}
          icon={ShieldCheck}
          tone="green"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-xl border border-[#e5eaf0] bg-white p-5 shadow-[0_2px_8px_rgba(15,35,58,.025)]">
          <SectionHeading
            eyebrow="Pipeline health"
            title="Qualification overview"
            action={
              <button
                onClick={onViewLeads}
                className="text-xs font-semibold text-[#00a1c5] hover:text-[#007e9c]"
              >
                View all leads <span aria-hidden>→</span>
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SmallStat label="P1" value={stats.p1} color="bg-violet-500" />
            <SmallStat label="P2" value={stats.p2} color="bg-cyan-500" />
            <SmallStat label="P3" value={stats.p3} color="bg-sky-300" />
            <SmallStat label="P4" value={stats.p4} color="bg-slate-300" />
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#eef2f5]">
            <div className="flex h-full">
              <div
                className="bg-violet-500"
                style={{ width: `${(stats.p1 / priorityTotal) * 100}%` }}
              />
              <div
                className="bg-cyan-500"
                style={{ width: `${(stats.p2 / priorityTotal) * 100}%` }}
              />
              <div
                className="bg-sky-300"
                style={{ width: `${(stats.p3 / priorityTotal) * 100}%` }}
              />
              <div
                className="bg-slate-300"
                style={{ width: `${(stats.p4 / priorityTotal) * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniMetric
              label="Pending audit"
              value={stats.pendingObjective}
              icon={Clock3}
            />
            <MiniMetric label="Pending qualitative" value={stats.pendingQualitative} icon={Clock3} />
            <MiniMetric label="On hold" value={stats.hold} icon={Inbox} />
            <MiniMetric
              label="Skipped"
              value={stats.skip}
              icon={MoreHorizontal}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[#e5eaf0] bg-[#0a1628] p-5 text-white shadow-[0_2px_8px_rgba(15,35,58,.06)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00d4ff]">
                Outreach pulse
              </p>
              <h2 className="mt-1 text-[17px] font-bold tracking-[-.025em]">
                Your momentum
              </h2>
            </div>
            <Activity size={18} className="text-[#00d4ff]" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-y-5">
            <DarkMetric label="Contacted" value={stats.contacted} />
            <DarkMetric label="Positive replies" value={stats.positive} />
            <DarkMetric label="Calls booked" value={stats.calls} />
            <DarkMetric label="Deals won" value={stats.won} />
          </div>
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] leading-relaxed text-slate-300">
              Priority score determines when to contact — every genuine
              opportunity remains reviewable.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5eaf0] bg-white shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="p-5 pb-3">
          <SectionHeading
            eyebrow="Next up"
            title="Decision queue"
            action={
              <span className="text-[11px] text-[#8a96a5]">
                Sorted by priority score
              </span>
            }
          />
        </div>
        <div className="divide-y divide-[#eef1f4]">
          {queue.map((lead) => (
            <button
              key={lead.leadId}
              onClick={() => onOpenLead(lead)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#fafcfd]"
            >
              <Initials name={lead.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#27364b]">
                  {lead.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[#8793a4]">
                  {lead.category} <span className="mx-1 text-[#c5cdd6]">·</span>{" "}
                  {lead.hasWebsite ? "Website audit" : "No website"}
                </p>
              </div>
              <div className="hidden min-w-[92px] sm:block">
                <p className="text-[10px] uppercase tracking-[.08em] text-[#98a3b1]">
                  Score
                </p>
                <p className="mt-0.5 text-sm font-bold text-[#27364b]">
                  {lead.score.total}
                  <span className="text-[10px] font-medium text-[#9aa5b1]">
                    /100
                  </span>
                </p>
              </div>
              <PriorityPill
                value={lead.score.priority}
                provisional={!lead.score.isFinal}
              />
              <ChevronRight size={15} className="text-[#aab5c0]" />
            </button>
          ))}
          {queue.length === 0 && (
            <div className="p-8 text-center text-sm text-[#8793a4]">
              Import leads to start building your decision queue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[#eef1f4] p-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-[11px] font-semibold text-[#718096]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-bold text-[#27364b]">{value}</p>
    </div>
  );
}
function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f7fa] text-[#7c8b9d]">
        <Icon size={14} />
      </span>
      <div>
        <p className="text-[10px] text-[#8995a3]">{label}</p>
        <p className="text-sm font-bold text-[#27364b]">{value}</p>
      </div>
    </div>
  );
}
function DarkMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 text-[24px] font-bold tracking-[-.04em] text-white">
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-[#e2e8ee] bg-white px-3 pr-8 text-xs font-medium text-[#5d6d80] outline-none transition focus:border-[#00bce3] focus:ring-2 focus:ring-[#00d4ff]/10"
      >
        <option value="">All {label}</option>
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-3 text-[#9aa6b4]"
      />
    </div>
  );
}

function LeadsView({
  leads,
  onOpenLead,
  onImport,
  onUpdateLead,
  lastImportReport,
}: {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onImport: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => void;
  lastImportReport: ImportReport | null;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [website, setWebsite] = useState("");
  const [ratingRange, setRatingRange] = useState("");
  const [reviewRange, setReviewRange] = useState("");
  const [qualification, setQualification] = useState("");
  const [priority, setPriority] = useState("");
  const [audit, setAudit] = useState("");
  const [outreach, setOutreach] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>(
    { key: "total", direction: "desc" },
  );
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState(defaultColumns);
  const [selected, setSelected] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const categories = useMemo(
    () => [...new Set(leads.map((lead) => lead.category))].sort(),
    [leads],
  );
  const sources = useMemo(
    () => [...new Set(leads.map((lead) => lead.sourceFile))].sort(),
    [leads],
  );
  const filtered = useMemo(() => {
    const result = leads.filter((lead) => {
      const haystack =
        `${lead.name} ${lead.address} ${lead.category} ${lead.phone ?? ""}`.toLowerCase();
      return (
        (!search || haystack.includes(search.toLowerCase())) &&
        (!category || lead.category === category) &&
        (!website ||
          (website === "yes" ? lead.hasWebsite : !lead.hasWebsite)) &&
        (!ratingRange ||
          (ratingRange === "4.5+"
            ? (lead.rating ?? 0) >= 4.5
            : ratingRange === "4+"
              ? (lead.rating ?? 0) >= 4
              : (lead.rating ?? 0) < 4)) &&
        (!reviewRange ||
          (reviewRange === "500+"
            ? (lead.totalRatings ?? 0) >= 500
            : reviewRange === "100+"
              ? (lead.totalRatings ?? 0) >= 100
              : (lead.totalRatings ?? 0) < 100)) &&
        (!qualification || lead.qualificationStatus === qualification) &&
        (!priority || lead.score.priority === priority) &&
        (!audit || (lead.audit.objectiveAuditStatus ?? lead.audit.status) === audit) &&
        (!outreach || lead.outreachStatus === outreach) &&
        (!source || lead.sourceFile === source)
      );
    });
    return result.sort((a, b) => {
      const valueA = getSortValue(a, sort.key);
      const valueB = getSortValue(b, sort.key);
      const comparison = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [
    audit,
    category,
    leads,
    outreach,
    priority,
    qualification,
    ratingRange,
    reviewRange,
    search,
    sort,
    source,
    website,
  ]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleLeads = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [
    category,
    website,
    ratingRange,
    reviewRange,
    qualification,
    priority,
    audit,
    outreach,
    source,
  ].filter(Boolean).length;
  const allVisibleSelected =
    visibleLeads.length > 0 &&
    visibleLeads.every((lead) => selected.includes(lead.leadId));
  function changeSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }
  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function toggleAll() {
    setSelected(
      allVisibleSelected
        ? selected.filter(
            (id) => !visibleLeads.some((lead) => lead.leadId === id),
          )
        : [
            ...new Set([
              ...selected,
              ...visibleLeads.map((lead) => lead.leadId),
            ]),
          ],
    );
  }
  function clearFilters() {
    setSearch("");
    setCategory("");
    setWebsite("");
    setRatingRange("");
    setReviewRange("");
    setQualification("");
    setPriority("");
    setAudit("");
    setOutreach("");
    setSource("");
    setPage(1);
  }
  function renderHeader(key: ColumnKey, label: string, sortable?: SortKey) {
    return (
      <th
        key={key}
        className={cn("px-3 py-3 text-left", !visible[key] && "hidden")}
      >
        {sortable ? (
          <button
            onClick={() => changeSort(sortable)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#8390a0] hover:text-[#27364b]"
          >
            {label}
            <ArrowUpDown size={12} />
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8390a0]">
            {label}
          </span>
        )}
      </th>
    );
  }
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            Lead database
          </p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">
            All leads
          </h1>
          <p className="mt-1 text-sm text-[#718096]">
            Review, qualify, and prioritize every opportunity.
          </p>
        </div>
        <button
          onClick={onImport}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#00bce3] px-3.5 py-2.5 text-xs font-bold text-[#06273a] shadow-[0_4px_12px_rgba(0,188,227,.18)] transition hover:bg-[#00d4ff]"
        >
          <Upload size={15} /> Import CSV
        </button>
      </div>
      {lastImportReport && <ImportReportCard report={lastImportReport} />}
      <div className="rounded-xl border border-[#e5eaf0] bg-white p-3 shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-3 text-[#9aa6b4]"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search businesses, addresses, phone..."
              className="h-9 w-full rounded-lg border border-[#e2e8ee] bg-[#fafcfd] pl-9 pr-3 text-xs text-[#27364b] outline-none placeholder:text-[#9aa6b4] focus:border-[#00bce3] focus:ring-2 focus:ring-[#00d4ff]/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="category"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
              className="w-[142px]"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="website"
              value={website}
              onChange={(value) => {
                setWebsite(value);
                setPage(1);
              }}
              className="w-[142px]"
            >
              {" "}
              <option value="yes">With website</option>
              <option value="no">No website</option>
            </FilterSelect>
            <FilterSelect
              label="status"
              value={qualification}
              onChange={(value) => {
                setQualification(value);
                setPage(1);
              }}
              className="w-[160px]"
            >
              {[
                "QUALIFIED",
                "REVIEW",
                "PENDING WEBSITE AUDIT",
                "PENDING QUALITATIVE AUDIT",
                "HOLD",
                "SKIP",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="priority"
              value={priority}
              onChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
              className="w-[128px]"
            >
              {[
                "P1 ULTRA",
                "P1 PREMIUM",
                "P2 STRONG",
                "P3 QUALIFIED",
                "P4 LOW",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="rating"
              value={ratingRange}
              onChange={(value) => {
                setRatingRange(value);
                setPage(1);
              }}
              className="w-[118px]"
            >
              <option value="4.5+">4.5+</option>
              <option value="4+">4.0+</option>
              <option value="below4">Below 4.0</option>
            </FilterSelect>
            <FilterSelect
              label="reviews"
              value={reviewRange}
              onChange={(value) => {
                setReviewRange(value);
                setPage(1);
              }}
              className="w-[118px]"
            >
              <option value="500+">500+</option>
              <option value="100+">100+</option>
              <option value="below100">Below 100</option>
            </FilterSelect>
            <FilterSelect
              label="audit"
              value={audit}
              onChange={(value) => {
                setAudit(value);
                setPage(1);
              }}
              className="w-[130px]"
            >
              {[
                "PENDING",
                "QUEUED",
                "AUDITING",
                "COMPLETE",
                "FAILED",
                "BLOCKED",
                "NOT REQUIRED",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="outreach"
              value={outreach}
              onChange={(value) => {
                setOutreach(value);
                setPage(1);
              }}
              className="w-[142px]"
            >
              {[
                "NOT STARTED",
                "PREVIEW QUEUED",
                "PREVIEW READY",
                "CONTACTED",
                "REPLIED",
                "POSITIVE",
                "CALL BOOKED",
                "WON",
                "LOST",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="source"
              value={source}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
              className="w-[160px]"
            >
              {sources.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <button
              onClick={() => setShowColumns((value) => !value)}
              className="relative flex h-9 items-center gap-2 rounded-lg border border-[#e2e8ee] px-3 text-xs font-semibold text-[#5d6d80] transition hover:border-[#cbd6e1] hover:text-[#27364b]"
            >
              <Columns3 size={14} /> Columns{" "}
              {showColumns && (
                <ColumnMenu visible={visible} setVisible={setVisible} />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#f0f2f5] pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8390a0]">
            <SlidersHorizontal size={13} /> Filters{" "}
            {activeFilters > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e5faff] px-1 text-[9px] text-[#0096b7]">
                {activeFilters}
              </span>
            )}
          </span>
          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-semibold text-[#00a1c5] hover:underline"
            >
              Clear all
            </button>
          )}
          <span className="ml-auto text-[11px] text-[#8a96a5]">
            <span className="font-semibold text-[#526275]">
              {filtered.length}
            </span>{" "}
            of {leads.length} leads
          </span>
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8a96a5]">
            Rows
            <select aria-label="Leads page size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-8 rounded-lg border border-[#e2e8ee] bg-white px-2 text-[11px] text-[#526275]">
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#bceef8] bg-[#effcff] px-4 py-2.5">
          <span className="text-xs font-bold text-[#176b7d]">
            {selected.length} selected
          </span>
          <button
            onClick={() =>
              selected.forEach((id) =>
                onUpdateLead(id, { manualDecision: "QUALIFY" }),
              )
            }
            className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#167b91] shadow-sm ring-1 ring-[#c9eaf0]"
          >
            Qualify
          </button>
          <button
            onClick={() =>
              selected.forEach((id) =>
                onUpdateLead(id, { manualDecision: "HOLD" }),
              )
            }
            className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#66758a] shadow-sm ring-1 ring-[#dde4eb]"
          >
            Hold
          </button>
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-[11px] font-semibold text-[#6d7d90] hover:text-[#27364b]"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-[#edf0f3] bg-[#fbfcfd]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    aria-label="Select all visible leads"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-[#00bce3]"
                  />
                </th>
                {renderHeader("business", "Business", "name")}
                {renderHeader("category", "Category", "category")}
                {renderHeader("rating", "Rating", "rating")}
                {renderHeader("website", "Website")}
                {renderHeader("score", "Score", "total")}
                {renderHeader("status", "Status", "qualificationStatus")}
                {renderHeader("priority", "Priority", "total")}
                {renderHeader("audit", "Audit")}
                {renderHeader("outreach", "Outreach")}
                <th className="w-10 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {visibleLeads.map((lead) => (
                <tr
                  key={lead.leadId}
                  onClick={() => onOpenLead(lead)}
                  className="group cursor-pointer transition hover:bg-[#fbfdfe]"
                >
                  <td
                    className="px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      aria-label={`Select ${lead.name}`}
                      type="checkbox"
                      checked={selected.includes(lead.leadId)}
                      onChange={() => toggleSelected(lead.leadId)}
                      className="h-3.5 w-3.5 accent-[#00bce3]"
                    />
                  </td>
                  <td
                    className={cn("px-3 py-3", !visible.business && "hidden")}
                  >
                    <div className="flex min-w-[190px] items-center gap-2.5">
                      <Initials name={lead.name} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#27364b] group-hover:text-[#008ca9]">
                          {lead.name}
                        </p>
                        <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#97a2af]">
                          {lead.address}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    className={cn("px-3 py-3", !visible.category && "hidden")}
                  >
                    <span className="text-xs font-medium text-[#536276]">
                      {lead.category}
                    </span>
                  </td>
                  <td className={cn("px-3 py-3", !visible.rating && "hidden")}>
                    <div>
                      <span className="text-xs font-bold text-[#27364b]">
                        {formatRating(lead.rating)}
                      </span>
                      {lead.totalRatings != null && (
                        <span className="ml-1 text-[10px] text-[#9aa6b4]">
                          ({formatReviews(lead.totalRatings)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={cn("px-3 py-3", !visible.website && "hidden")}>
                    {lead.hasWebsite ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1684a0]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8a96a5]">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />{" "}
                        No
                      </span>
                    )}
                  </td>
                  <td className={cn("px-3 py-3", !visible.score && "hidden")}>
                    <div>
                      <span className="text-sm font-bold text-[#27364b]">
                        {lead.score.total}
                      </span>
                      <span className="text-[10px] text-[#9aa6b4]">/100</span>
                      {!lead.score.isFinal && (
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-amber-600">
                          Provisional
                        </p>
                      )}
                    </div>
                  </td>
                  <td className={cn("px-3 py-3", !visible.status && "hidden")}>
                    <StatusPill value={lead.qualificationStatus} compact />
                  </td>
                  <td
                    className={cn("px-3 py-3", !visible.priority && "hidden")}
                  >
                    <PriorityPill
                      value={lead.score.priority}
                      provisional={!lead.score.isFinal}
                    />
                  </td>
                  <td className={cn("px-3 py-3", !visible.audit && "hidden")}>
                    <StatusPill value={lead.audit.objectiveAuditStatus ?? lead.audit.status} compact />
                  </td>
                  <td
                    className={cn("px-3 py-3", !visible.outreach && "hidden")}
                  >
                    <StatusPill value={lead.outreachStatus} compact />
                  </td>
                  <td className="px-3 py-3">
                    <ChevronRight
                      size={15}
                      className="text-[#b5c0cb] transition group-hover:translate-x-0.5 group-hover:text-[#00aaca]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleLeads.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#effbfe] text-[#00aaca]">
                <Search size={17} />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#4b5b6f]">
                No leads match those filters
              </p>
              <p className="mt-1 text-xs text-[#8c98a6]">
                Try clearing a filter or importing a new file.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0f3] px-4 py-3">
          <p className="text-[11px] text-[#8a96a5]">
            Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e3e8ed] text-[#7d8b9b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 text-[11px] font-semibold text-[#5d6d80]">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e3e8ed] text-[#7d8b9b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSortValue(lead: Lead, key: SortKey): string | number {
  if (key === "name") return lead.name;
  if (key === "category") return lead.category;
  if (key === "rating") return lead.rating ?? -1;
  if (key === "totalRatings") return lead.totalRatings ?? -1;
  if (key === "total") return lead.score.total;
  if (key === "qualificationStatus") return lead.qualificationStatus;
  return lead.outreachStatus;
}
function ColumnMenu({
  visible,
  setVisible,
}: {
  visible: Record<ColumnKey, boolean>;
  setVisible: React.Dispatch<React.SetStateAction<Record<ColumnKey, boolean>>>;
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="absolute right-0 top-11 z-20 w-44 rounded-lg border border-[#e2e8ee] bg-white p-2 text-left shadow-[0_10px_30px_rgba(15,35,58,.12)]"
    >
      {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#5d6d80] hover:bg-[#f5f7fa]"
        >
          <input
            type="checkbox"
            checked={visible[key]}
            onChange={() =>
              setVisible((current) => ({ ...current, [key]: !current[key] }))
            }
            className="h-3.5 w-3.5 accent-[#00bce3]"
          />
          {columnLabels[key]}
        </label>
      ))}
    </div>
  );
}

function AuditSignalCell({ found }: { found?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
        found
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500",
      )}
    >
      {found ? "Yes" : "No"}
    </span>
  );
}

function AuditTextCell({
  value,
  empty = "—",
}: {
  value?: string;
  empty?: string;
}) {
  return (
    <span
      className="block max-w-[190px] truncate text-[11px] text-[#526275]"
      title={value}
    >
      {value || empty}
    </span>
  );
}

function WebsiteAuditView({
  leads,
  onOpenLead,
  onAuditSelected,
  onAuditNext,
  onAnalyzeSelected,
  onAnalyzeNext,
  auditingIds,
  analyzingIds,
}: {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onAuditSelected: (ids: string[]) => Promise<void>;
  onAuditNext: (count: number) => Promise<void>;
  onAnalyzeSelected: (ids: string[]) => Promise<void>;
  onAnalyzeNext: (count: number) => Promise<void>;
  auditingIds: string[];
  analyzingIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batchSize, setBatchSize] = useState("20");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const statuses = [
    "PENDING",
    "QUEUED",
    "AUDITING",
    "COMPLETE",
    "FAILED",
    "BLOCKED",
  ];
  const qualitativeStatuses = ["PENDING", "ANALYZING", "COMPLETE", "FAILED"] as const;
  const websiteLeads = leads.filter((lead) => lead.hasWebsite && lead.website);
  const filtered = websiteLeads.filter((lead) => {
    const haystack =
      `${lead.name} ${lead.website ?? ""} ${lead.address}`.toLowerCase();
    return (
      (!search || haystack.includes(search.toLowerCase())) &&
      (!status || (lead.audit.objectiveAuditStatus ?? lead.audit.status) === status)
    );
  });
  const [qualitativeStatus, setQualitativeStatus] = useState("");
  const qualitativeFiltered = filtered.filter((lead) => (
    !qualitativeStatus || qualitativeStatusFor(lead.audit) === qualitativeStatus
  ));
  const totalPages = Math.max(1, Math.ceil(qualitativeFiltered.length / pageSize));
  const visible = qualitativeFiltered.slice((page - 1) * pageSize, page * pageSize);
  const allVisibleSelected =
    visible.length > 0 &&
    visible.every((lead) => selected.includes(lead.leadId));
  const eligibleCount = websiteLeads.filter((lead) =>
    ["PENDING", "FAILED", "BLOCKED"].includes(lead.audit.objectiveAuditStatus ?? lead.audit.status),
  ).length;
  const qualitativeEligibleCount = websiteLeads.filter((lead) =>
    ["PENDING", "FAILED"].includes(qualitativeStatusFor(lead.audit)),
  ).length;
  const requestedBatch = Math.min(50, Math.max(1, Number(batchSize) || 20));

  function toggleAll() {
    setSelected(
      allVisibleSelected
        ? selected.filter((id) => !visible.some((lead) => lead.leadId === id))
        : [...new Set([...selected, ...visible.map((lead) => lead.leadId)])],
    );
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            Sprint 2A · Objective evidence
          </p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">
            Website audit
          </h1>
          <p className="mt-1 text-sm text-[#718096]">
            Homepage audits only. Imports never start audits automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e2e8ee] bg-white px-2.5 text-[11px] font-semibold text-[#718096]">
            Batch
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={(event) => setBatchSize(event.target.value)}
              className="w-10 bg-transparent text-center text-xs font-bold text-[#27364b] outline-none"
              aria-label="Audit batch size"
            />
          </label>
          <button
            onClick={() => void onAuditNext(requestedBatch)}
            disabled={auditingIds.length > 0 || eligibleCount === 0}
            className="flex items-center gap-2 rounded-lg bg-[#0a1628] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-[#10223b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={14} /> Audit next {requestedBatch}
          </button>
          <button
            onClick={() => void onAuditSelected(selected)}
            disabled={auditingIds.length > 0 || analyzingIds.length > 0 || selected.length === 0}
            className="flex items-center gap-2 rounded-lg bg-[#00bce3] px-3.5 py-2.5 text-xs font-bold text-[#06273a] transition hover:bg-[#00d4ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={14} /> Audit selected ({selected.length})
          </button>
          <button
            onClick={() => void onAnalyzeNext(requestedBatch)}
            disabled={auditingIds.length > 0 || analyzingIds.length > 0 || qualitativeEligibleCount === 0}
            className="flex items-center gap-2 rounded-lg border border-[#bfeaf2] bg-white px-3.5 py-2.5 text-xs font-bold text-[#1684a0] transition hover:bg-[#f4fdff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={14} /> Analyze next {requestedBatch}
          </button>
          <button
            onClick={() => void onAnalyzeSelected(selected)}
            disabled={auditingIds.length > 0 || analyzingIds.length > 0 || selected.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[#bfeaf2] bg-[#f4fdff] px-3.5 py-2.5 text-xs font-bold text-[#176b7d] transition hover:bg-[#e9fbff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={14} /> Analyze selected ({selected.length})
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#bfeaf2] bg-[#f4fdff] px-4 py-3 text-[11px] text-[#627889]">
        <Globe2 size={14} className="text-[#00aaca]" />
        <span>
          <strong className="text-[#176b7d]">{websiteLeads.length}</strong>{" "}
          websites in scope
        </span>
        <span className="text-[#c2d6dc]">·</span>
        <span>
          <strong className="text-[#176b7d]">{eligibleCount}</strong> ready for
          audit or retry
        </span>
        <span className="text-[#c2d6dc]">·</span>
        <span>
          <strong className="text-[#176b7d]">{qualitativeEligibleCount}</strong> ready for qualitative analysis
        </span>
        <span className="text-[#c2d6dc]">·</span>
        <span>Default batch is 20; maximum is 50.</span>
      </div>
      <div className="rounded-xl border border-[#e5eaf0] bg-white p-3 shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-3 text-[#9aa6b4]"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search businesses or websites..."
              className="h-9 w-full rounded-lg border border-[#e2e8ee] bg-[#fafcfd] pl-9 pr-3 text-xs text-[#27364b] outline-none placeholder:text-[#9aa6b4] focus:border-[#00bce3]"
            />
          </div>
          <FilterSelect
            label="audit status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            className="w-[170px]"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="qualitative status"
            value={qualitativeStatus}
            onChange={(value) => {
              setQualitativeStatus(value);
              setPage(1);
            }}
            className="w-[190px]"
          >
            {qualitativeStatuses.map((item) => (
              <option key={item} value={item}>
                {item === "PENDING" ? "PENDING QUALITATIVE AUDIT" : item}
              </option>
            ))}
          </FilterSelect>
          <span className="flex items-center px-1 text-[11px] text-[#8a96a5]">
            {qualitativeFiltered.length} of {websiteLeads.length}
          </span>
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8a96a5]">
            Rows
            <select aria-label="Audit page size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-[#e2e8ee] bg-white px-2 text-[11px] text-[#526275]">
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse">
            <thead className="border-b border-[#edf1f4] bg-[#fbfcfd]">
              <tr>
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-[#00bce3]"
                    aria-label="Select visible audits"
                  />
                </th>
                {[
                  "Business",
                  "Website",
                  "Audit Status",
                  "Qualitative",
                  "HTTP",
                  "HTTPS",
                  "Phone",
                  "WhatsApp",
                  "Booking",
                  "Contact Form",
                  "Title",
                  "H1",
                  "Schema",
                  "Audit Date",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[.08em] text-[#8390a0]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {visible.map((lead) => {
                const audit = lead.audit;
                const isAuditing = auditingIds.includes(lead.leadId);
                return (
                  <tr
                    key={lead.leadId}
                    onClick={() => onOpenLead(lead)}
                    className="cursor-pointer transition hover:bg-[#fbfdfe]"
                  >
                    <td
                      className="px-3 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(lead.leadId)}
                        onChange={() => toggleSelected(lead.leadId)}
                        className="h-3.5 w-3.5 accent-[#00bce3]"
                        aria-label={`Select ${lead.name}`}
                      />
                    </td>
                    <td className="max-w-[190px] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Initials name={lead.name} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#27364b]">
                            {lead.name}
                          </p>
                          <p className="truncate text-[10px] text-[#8a96a5]">
                            {lead.address}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-3 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[190px] items-center gap-1 truncate text-[11px] font-semibold text-[#1684a0] hover:underline"
                      >
                        {lead.website}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill
                          value={isAuditing ? "AUDITING" : (audit.objectiveAuditStatus ?? audit.status)}
                          compact
                        />
                        {audit.failureReason && (
                          <span className="text-[9px] font-semibold text-rose-600">
                            {audit.failureReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill value={qualitativeStatusFor(audit)} compact />
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-[#526275]">
                      {audit.httpStatus ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <AuditSignalCell found={audit.https} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditSignalCell found={audit.phoneFound} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditSignalCell found={audit.whatsappFound} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditSignalCell found={audit.bookingFound} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditSignalCell found={audit.contactFormFound} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditTextCell value={audit.pageTitle} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditTextCell value={audit.h1?.join(" · ")} />
                    </td>
                    <td className="px-3 py-3">
                      <AuditTextCell value={audit.schemaTypes?.join(", ")} />
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#718096]">
                      {audit.auditTimestamp
                        ? new Date(audit.auditTimestamp).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="p-12 text-center text-sm text-[#8793a4]">
            No website audits match this filter.
          </div>
        )}
        <div className="flex items-center justify-between border-t border-[#edf1f4] px-4 py-3">
          <span className="text-[11px] text-[#8a96a5]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e2e8ee] text-[#718096] disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e2e8ee] text-[#718096] disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QualifiedView({ leads, onOpenLead }: { leads: Lead[]; onOpenLead: (lead: Lead) => void }) {
  const qualified = leads.filter((lead) => lead.qualificationStatus === "QUALIFIED" && lead.manualDecision !== "HOLD" && lead.manualDecision !== "SKIP");
  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">Decision output</p>
        <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">Qualified leads</h1>
        <p className="mt-1 text-sm text-[#718096]">Only genuinely qualified leads and explicit QUALIFY overrides appear here.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="border-b border-[#edf1f4] bg-[#fbfcfd]"><tr>{["Business", "Website", "Score", "Priority", "Qualification", ""].map((label) => <th key={label} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[.08em] text-[#8390a0]">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {qualified.map((lead) => <tr key={lead.leadId} onClick={() => onOpenLead(lead)} className="cursor-pointer hover:bg-[#fbfdfe]"><td className="px-4 py-3"><p className="text-xs font-bold text-[#27364b]">{lead.name}</p><p className="mt-0.5 text-[10px] text-[#8a96a5]">{lead.address}</p></td><td className="px-4 py-3 text-[11px] text-[#526275]">{lead.website ?? "No website"}</td><td className="px-4 py-3 text-xs font-bold text-[#27364b]">{lead.score.isFinal ? `${lead.score.total}/100` : `Provisional ${lead.score.total}/100`}</td><td className="px-4 py-3"><PriorityPill value={lead.score.priority} provisional={!lead.score.isFinal} /></td><td className="px-4 py-3"><StatusPill value="QUALIFIED" compact /></td><td className="px-4 py-3"><ChevronRight size={15} className="text-[#b5c0cb]" /></td></tr>)}
              {qualified.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-[#8793a4]">No qualified leads yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyView({
  view,
  leads,
  onImport,
  mode,
  onClearImported,
  onResetDemo,
}: {
  view: ViewName;
  leads: Lead[];
  onImport: () => void;
  mode: WorkspaceMode;
  onClearImported: () => void;
  onResetDemo: () => void;
}) {
  const details: Record<
    Exclude<ViewName, "Overview" | "Leads">,
    { icon: typeof Globe2; title: string; body: string; stat: string }
  > = {
    "Website Audit": {
      icon: Globe2,
      title: "Website audit workspace",
      body: "Automated audits will land here once the crawler is connected. For now, website leads remain queued for human review.",
      stat: `${leads.filter((lead) => lead.hasWebsite && (lead.audit.objectiveAuditStatus ?? lead.audit.status) === "PENDING").length} websites pending audit`,
    },
    Qualified: {
      icon: ShieldCheck,
      title: "Qualified leads",
      body: "No-website leads that pass the current opportunity gate and manually QUALIFY decisions collect here. Website leads remain pending qualitative review in Sprint 2A.",
      stat: `${leads.filter((lead) => lead.qualificationStatus === "QUALIFIED").length} currently qualified`,
    },
    "Preview Studio": {
      icon: Sparkles,
      title: "Preview Studio",
      body: "Generate V0 prompt packs for qualified leads. Build personalized previews in v0.app, add the final URL, and approve for outreach.",
      stat: `${leads.filter((lead) => lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY").length} eligible leads`,
    },
    Outreach: {
      icon: Mail,
      title: "Outreach workspace",
      body: "Contact history, follow-up stages, and outcomes will be managed here in the next sprint.",
      stat: `${leads.filter((lead) => lead.outreachStatus !== "NOT STARTED").length} leads with outreach activity`,
    },
    Settings: {
      icon: Settings2,
      title: "Workspace settings",
      body: "Configure imports, scoring defaults, team access, and integrations when those workflows are ready.",
      stat: "Sprint 2 workspace",
    },
  };
  const detail = details[view as keyof typeof details];
  const Icon = detail.icon;
  return (
    <div className="animate-fade-in flex min-h-[560px] items-center justify-center rounded-xl border border-[#e5eaf0] bg-white p-8 text-center shadow-[0_2px_8px_rgba(15,35,58,.025)]">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9fbff] text-[#00aaca]">
          <Icon size={25} />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
          Workspace ready
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-.04em] text-[#17243a]">
          {detail.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#718096]">{detail.body}</p>
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-[#f5f7fa] px-3 py-1.5 text-[11px] font-semibold text-[#627286]">
          <Gauge size={13} className="text-[#00aaca]" /> {detail.stat}
        </div>
        {view === "Website Audit" && (
          <button
            onClick={onImport}
            className="mx-auto mt-6 flex items-center gap-2 rounded-lg bg-[#0a1628] px-3.5 py-2.5 text-xs font-semibold text-white"
          >
            <Upload size={14} /> Import more leads
          </button>
        )}
        {view === "Settings" && (
          <div className="mt-7 rounded-xl border border-[#e5eaf0] bg-[#fbfcfd] p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#27364b]">
                  Workspace data
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#8793a4]">
                  Current mode:{" "}
                  <span className="font-bold text-[#526275]">{mode}</span>.
                  Reset actions require confirmation.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em]",
                  mode === "DEMO"
                    ? "bg-violet-50 text-violet-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {mode}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onClearImported}
                disabled={mode !== "PRODUCTION"}
                className="rounded-lg border border-[#e1e7ec] bg-white px-3 py-2 text-[11px] font-semibold text-[#67778a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear imported leads
              </button>
              <button
                onClick={onResetDemo}
                className="rounded-lg bg-[#0a1628] px-3 py-2 text-[11px] font-semibold text-white"
              >
                Reset to demo data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  accent = "#00bce3",
}: {
  label: string;
  value: number;
  max: number;
  accent?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[#5d6d80]">{label}</span>
        <span className="text-xs font-bold text-[#27364b]">
          {value}
          <span className="font-normal text-[#9aa6b4]"> / {max}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f4]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            backgroundColor: accent,
          }}
        />
      </div>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onUpdateLead,
  onAnalyzeLead,
  qualitativeRunning,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => void;
  onAnalyzeLead: (id: string) => Promise<void>;
  qualitativeRunning: boolean;
}) {
  const decision = (value: ManualDecision) =>
    onUpdateLead(lead.leadId, { manualDecision: value });
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#07111f]/35 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <aside
        onMouseDown={(event) => event.stopPropagation()}
        className="animate-fade-in flex h-full w-full max-w-[490px] flex-col overflow-hidden bg-white shadow-[-12px_0_36px_rgba(10,22,40,.14)]"
      >
        <div className="flex items-center justify-between border-b border-[#e8edf1] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
              Lead detail
            </p>
            <p className="mt-1 text-xs text-[#8793a4]">{lead.leadId}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a96a5] hover:bg-[#f5f7fa] hover:text-[#27364b]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-[#eef1f4] px-5 py-5">
            <div className="flex gap-3">
              <Initials name={lead.name} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-bold tracking-[-.035em] text-[#17243a]">
                  {lead.name}
                </h2>
                <p className="mt-1 text-xs text-[#718096]">
                  {lead.category} <span className="mx-1 text-[#c4cdd6]">·</span>{" "}
                  {lead.address}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusPill value={lead.qualificationStatus} />
                  <PriorityPill
                    value={lead.score.priority}
                    provisional={!lead.score.isFinal}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <InfoItem icon={Phone} value={lead.phone ?? "No phone"} />
              <InfoItem icon={Mail} value={lead.email ?? "No email"} />
              <InfoItem
                icon={Globe2}
                value={
                  lead.hasWebsite ? (lead.website ?? "Website") : "No website"
                }
                link={lead.website}
              />
              <InfoItem icon={FileText} value={lead.sourceFile} />
              <InfoItem
                icon={Gauge}
                label="Rating / reviews"
                value={`${formatRating(lead.rating)} · ${formatReviews(lead.totalRatings)}`}
              />
            </div>
          </div>
          <div className="border-b border-[#eef1f4] px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
                  Human decision
                </p>
                <p className="mt-1 text-xs text-[#a0aab6]">
                  Overrides automatic qualification
                </p>
              </div>
              <span className="rounded-full bg-[#f5f7fa] px-2 py-1 text-[10px] font-semibold text-[#728196]">
                {lead.manualDecision === "NONE"
                  ? "No override"
                  : lead.manualDecision}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {(["NONE", "QUALIFY", "HOLD", "SKIP"] as ManualDecision[]).map(
                (option) => (
                  <button
                    key={option}
                    onClick={() => decision(option)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-[10px] font-bold uppercase tracking-[.04em] transition",
                      lead.manualDecision === option
                        ? "border-[#00bce3] bg-[#e9fbff] text-[#007d98]"
                        : "border-[#e3e8ed] text-[#7a8898] hover:border-[#b9c7d2]",
                    )}
                  >
                    {option === "NONE" ? "Auto" : option}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="border-b border-[#eef1f4] px-5 py-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
                  Qualification score
                </p>
                <p className="mt-1 text-xs text-[#a0aab6]">
                  {lead.score.isFinal
                    ? "Final calculation"
                    : "Provisional calculation"}{" "}
                  · category never disqualifies
                </p>
              </div>
              <div className="text-right">
                <span className="text-[28px] font-bold tracking-[-.06em] text-[#17243a]">
                  {lead.score.isFinal
                    ? lead.score.total
                    : `Provisional ${lead.score.total}/100`}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-[#728196]">
              <span>Objective: {lead.audit.objectiveAuditStatus ?? lead.audit.status}</span>
              {lead.hasWebsite && <span>Qualitative: {lead.audit.qualitativeAuditStatus ?? "NOT_READY"}</span>}
            </div>
            <div className="mt-5 space-y-4">
              <ScoreBar
                label="Business strength"
                value={lead.score.businessStrength}
                max={25}
                accent="#6172e8"
              />
              <ScoreBar
                label={
                  lead.score.pendingComponents.includes(
                    "Website audit evidence",
                  )
                    ? "Opportunity (pending audit)"
                    : "Opportunity"
                }
                value={lead.score.opportunity}
                max={40}
                accent="#00bce3"
              />
              <ScoreBar
                label="Reachability"
                value={lead.score.reachability}
                max={15}
                accent="#22b99a"
              />
              <ScoreBar
                label="Preview potential"
                value={lead.score.previewPotential}
                max={20}
                accent="#f0aa45"
              />
            </div>
            <div className="mt-5 rounded-lg border border-[#edf1f4] bg-[#fbfcfd] p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00bce3]" />
                <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#718096]">
                  Automatic qualification
                </p>
                <span className="ml-auto">
                  <StatusPill value={lead.automaticQualification} compact />
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6f7e8f]">
                {lead.score.pendingComponents.includes("Website audit evidence")
                  ? "A website audit is needed before the objective opportunity gate can be evaluated."
                  : lead.hasWebsite
                    ? "Objective audit evidence is available. Final qualitative qualification remains pending for Sprint 2B."
                    : lead.score.opportunityConfirmed
                      ? "Opportunity gate confirmed by the current signals."
                      : "Signals are not strong enough to confirm an opportunity yet; review remains available."}
              </p>
            </div>
          </div>
          <div className="border-b border-[#eef1f4] px-5 py-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
                Problems & context
              </p>
              {lead.audit.status !== "NOT REQUIRED" && (
                <StatusPill value={lead.audit.objectiveAuditStatus ?? lead.audit.status} compact />
              )}
            </div>
            {lead.audit.mainProblem && (
              <p className="mt-3 text-sm font-semibold leading-5 text-[#27364b]">
                {lead.audit.mainProblem}
              </p>
            )}
            <ProblemGroup
              label="Critical"
              items={lead.audit.criticalProblems ?? []}
              tone="text-rose-600"
            />
            <ProblemGroup
              label="Major"
              items={lead.audit.majorProblems ?? []}
              tone="text-amber-600"
            />
            <ProblemGroup
              label="Minor"
              items={lead.audit.minorProblems ?? []}
              tone="text-slate-500"
            />
            {!lead.audit.mainProblem &&
              !(lead.audit.criticalProblems?.length ?? 0) &&
              !(lead.audit.majorProblems?.length ?? 0) &&
              !(lead.audit.minorProblems?.length ?? 0) && (
                <p className="mt-3 text-xs text-[#8a96a5]">
                  No audit problems recorded yet.
                </p>
              )}
          </div>
          {lead.hasWebsite && <AuditEvidence audit={lead.audit} />}
          {lead.hasWebsite && (
            <QualitativeAnalysis
              lead={lead}
              onAnalyze={() => onAnalyzeLead(lead.leadId)}
              running={qualitativeRunning}
            />
          )}
          <div className="border-b border-[#eef1f4] px-5 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
              Preview recommendation
            </p>
            <div className="mt-3 rounded-lg bg-[#f4fbfd] p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#176b7d]">
                  {lead.previewRecommendation ?? "Needs review"}
                </p>
                <Sparkles size={15} className="text-[#00aaca]" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#5e7482]">
                {lead.previewAngle ??
                  "Add a personalized angle after the qualification decision."}
              </p>
              {lead.personalizedHook && (
                <p className="mt-3 border-t border-[#d8f1f5] pt-3 text-[11px] italic leading-relaxed text-[#68818d]">
                  “{lead.personalizedHook}”
                </p>
              )}
            </div>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
                Outreach
              </p>
              <StatusPill value={lead.outreachStatus} compact />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <InfoItem
                icon={Activity}
                label="Follow-up stage"
                value={`${lead.followupStage} / 3`}
              />
              <InfoItem
                icon={CalendarDays}
                label="Queue date"
                value={lead.queueDate ?? "Not queued"}
              />
            </div>
            {lead.notes && (
              <div className="mt-4 rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-3 text-[11px] leading-relaxed text-[#6f7e8f]">
                <span className="font-bold text-[#526275]">Notes: </span>
                {lead.notes}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-[#e8edf1] bg-[#fbfcfd] px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[#0a1628] py-2.5 text-xs font-bold text-white transition hover:bg-[#10223b]"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}
function InfoItem({
  icon: Icon,
  value,
  label,
  link,
}: {
  icon: typeof Phone;
  value: string;
  label?: string;
  link?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-2.5">
      <div className="flex items-center gap-1.5 text-[#8b98a7]">
        <Icon size={12} />
        {label && (
          <span className="text-[9px] font-bold uppercase tracking-[.08em]">
            {label}
          </span>
        )}
      </div>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-[11px] font-semibold text-[#1684a0] hover:underline"
        >
          {value}
          <ExternalLink size={10} className="ml-1 inline" />
        </a>
      ) : (
        <p className="mt-1 truncate text-[11px] font-semibold text-[#526275]">
          {value}
        </p>
      )}
    </div>
  );
}
function ProblemGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p
        className={cn("text-[10px] font-bold uppercase tracking-[.08em]", tone)}
      >
        {label}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[11px] leading-4 text-[#6f7e8f]"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceSignal({
  label,
  found,
  evidence,
}: {
  label: string;
  found?: boolean;
  evidence?: string[];
}) {
  return (
    <div className="rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#526275]">
          {label}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
            found
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500",
          )}
        >
          {found ? "Found" : "Not found"}
        </span>
      </div>
      {!!evidence?.length && (
        <div className="mt-1.5 space-y-1">
          {evidence.map((item) => (
            <p
              key={item}
              className="break-words text-[10px] leading-4 text-[#7a8898]"
            >
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const qualitativeDimensionLabels: Record<string, string> = {
  mobileResponsive: "Mobile / Responsive",
  heroMessageClarity: "Hero / Message Clarity",
  ctaContactBooking: "CTA / Contact / Booking",
  visualTrustDesign: "Visual Trust / Design",
  servicesNavigation: "Services / Navigation",
  speedPerformance: "Speed / Performance",
  reviewsTeamTrust: "Reviews / Team / Trust",
  localSeoTechnical: "Local SEO / Technical",
};

function QualitativeAnalysis({
  lead,
  onAnalyze,
  running,
}: {
  lead: Lead;
  onAnalyze: () => Promise<void>;
  running: boolean;
}) {
  const audit = lead.audit;
  const status = qualitativeStatusFor(audit);
  const result = audit.qualitativeResult;
  const canAnalyze = audit.objectiveAuditStatus === "COMPLETE" && !running;
  return (
    <div className="border-b border-[#eef1f4] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
            Qualitative AI analysis
          </p>
          <p className="mt-1 text-[11px] text-[#a0aab6]">
            Evidence-bound review of the completed objective audit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill value={status} compact />
          {canAnalyze && (
            <button
              onClick={() => void onAnalyze()}
              className="rounded-md border border-[#bfeaf2] bg-[#f4fdff] px-2 py-1.5 text-[10px] font-bold text-[#1684a0] hover:bg-[#e9fbff]"
            >
              {result ? "Re-analyze" : "Analyze"}
            </button>
          )}
        </div>
      </div>
      {audit.qualitativeFailureReason && (
        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700">
          <span className="font-bold">{audit.qualitativeFailureReason}:</span>{" "}
          {audit.qualitativeFailureMessage ?? "Qualitative analysis failed."}
        </div>
      )}
      {!result && !audit.qualitativeFailureReason && (
        <p className="mt-3 text-xs text-[#8a96a5]">
          {status === "NOT_READY"
            ? "Complete the objective audit before running qualitative analysis."
            : "No qualitative result has been stored yet."}
        </p>
      )}
      {result && (
        <>
          <div className="mt-4 flex items-end justify-between rounded-lg border border-[#d8f1f5] bg-[#f4fdff] p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#718096]">Website opportunity</p>
              <p className="mt-1 text-2xl font-bold text-[#176b7d]">{result.websiteOpportunityScore}/40</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", result.opportunityGate.passes ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
              Gate {result.opportunityGate.passes ? "passes" : "does not pass"}
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-[#eef1f4] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8793a4]">Main problem</p>
              <StatusPill value={result.mainProblemSeverity} compact />
            </div>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#27364b]">{result.mainProblem}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#6f7e8f]">{result.qualificationReason}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(result.dimensions).map(([key, dimension]) => (
              <div key={key} className="rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#526275]">{qualitativeDimensionLabels[key] ?? key}</span>
                  <span className="text-[10px] font-bold text-[#176b7d]">{dimension.score}/{dimension.maxScore}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill value={dimension.severity} compact />
                  <span className="text-[9px] font-semibold uppercase text-[#9aa6b4]">{dimension.confidence} confidence</span>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#6f7e8f]">{dimension.reason}</p>
                {!!dimension.evidenceUsed.length && (
                  <p className="mt-1 text-[9px] leading-4 text-[#9aa6b4]">
                    Evidence: {dimension.evidenceUsed.map((item) => `${item.source}.${item.field}`).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!!result.secondaryProblems.length && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8793a4]">Secondary problems</p>
              <ul className="mt-2 space-y-1">
                {result.secondaryProblems.map((problem) => (
                  <li key={problem.title} className="text-[11px] leading-4 text-[#6f7e8f]">
                    <span className="font-semibold text-[#526275]">{problem.title}</span> ({problem.severity}) — {problem.evidence}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <InfoItem icon={Sparkles} label="Qualification" value={result.qualificationDecision} />
            <InfoItem icon={Zap} label="Outreach angle" value={result.outreachAngle} />
            <InfoItem icon={Sparkles} label="Preview" value={`${result.recommendedPreviewDepth}: ${result.recommendedPreviewFocus}`} />
            <InfoItem icon={FileText} label="Recommended CTA" value={result.recommendedCTA} />
          </div>
          <div className="mt-3 rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-3 text-[11px] leading-relaxed text-[#6f7e8f]">
            <span className="font-bold text-[#526275]">Hero angle: </span>{result.recommendedHeroAngle}
            <br />
            <span className="font-bold text-[#526275]">Sections: </span>{result.recommendedSections.join(" · ") || "None"}
          </div>
          <p className="mt-2 text-[9px] text-[#9aa6b4]">Model {result.modelVersion} · analyzed {new Date(result.analyzedAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

function AuditEvidence({ audit }: { audit: WebsiteAudit }) {
  const publicScreenshot = audit.screenshotPath?.startsWith(
    "/audit-screenshots/",
  );
  const screenshotHref = audit.screenshotUrl
    ? `/api/audit/screenshot?url=${encodeURIComponent(audit.screenshotUrl)}`
    : audit.screenshotPath;
  const technical = [
    ["Requested URL", audit.requestedUrl],
    ["Final URL", audit.finalUrl],
    ["HTTP status", audit.httpStatus],
    ["HTTPS", audit.https == null ? undefined : audit.https ? "Yes" : "No"],
    ["Redirects", audit.redirectCount],
    [
      "Page reachable",
      audit.pageReachable == null
        ? undefined
        : audit.pageReachable
          ? "Yes"
          : "No",
    ],
    ["Page title", audit.pageTitle],
    ["Meta description", audit.metaDescription],
    ["H1", audit.h1?.join(" · ")],
    ["Canonical", audit.canonical],
    ["Robots meta", audit.robotsMeta],
    [
      "Mobile viewport",
      audit.mobileViewport == null
        ? undefined
        : audit.mobileViewport
          ? "Yes"
          : "No",
    ],
    ["Schema types", audit.schemaTypes?.join(", ")],
    ["Language", audit.language],
    [
      "DOM/load timing",
      audit.performance
        ? `${audit.performance.domContentLoadedMs ?? "—"} / ${audit.performance.loadEventMs ?? "—"} ms`
        : undefined,
    ],
    ["Audit timestamp", audit.auditTimestamp],
  ] as const;
  const signals = [
    ["Phone links", audit.phoneFound, audit.phoneEvidence],
    ["WhatsApp links", audit.whatsappFound, audit.whatsappEvidence],
    ["Email links", audit.emailFound, audit.emailEvidence],
    ["Booking / appointment", audit.bookingFound, audit.bookingEvidence],
    ["Contact forms", audit.contactFormFound, audit.contactFormEvidence],
    [
      "Google Maps / directions",
      audit.googleMapsFound,
      audit.googleMapsEvidence,
    ],
    ["Social links", audit.socialFound, audit.socialEvidence],
    ["Reviews / testimonials", audit.reviewsIndicators, audit.reviewsEvidence],
    ["Team / doctor indicators", audit.teamIndicators, audit.teamEvidence],
    ["Services / treatments", audit.servicesIndicators, audit.servicesEvidence],
    ["Location / address", audit.locationIndicators, audit.locationEvidence],
  ] as const;
  return (
    <div className="border-b border-[#eef1f4] px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#8793a4]">
            Objective audit evidence
          </p>
          <p className="mt-1 text-[11px] text-[#a0aab6]">
            Homepage signals are kept separate from the qualitative analysis below.
          </p>
        </div>
        {screenshotHref && (publicScreenshot || audit.screenshotUrl) && (
          <a
            href={screenshotHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#dce7ec] px-2 py-1.5 text-[10px] font-bold text-[#1684a0] hover:bg-[#f4fbfd]"
          >
            Screenshot <ExternalLink size={10} />
          </a>
        )}
        {audit.screenshotError && (
          <span className="max-w-[150px] text-right text-[10px] font-semibold text-[#8a96a5]">
            Screenshot upload failed; audit evidence is still available
          </span>
        )}
        {audit.simulated && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase text-violet-700">Simulated demo</span>}
      </div>
      {audit.failureReason && (
        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-700">
          <span className="font-bold">{audit.failureReason}:</span>{" "}
          {audit.failureMessage ?? "The audit did not complete."}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {technical.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-lg border border-[#eef1f4] bg-white p-2.5"
          >
            <p className="text-[9px] font-bold uppercase tracking-[.06em] text-[#9aa6b4]">
              {label}
            </p>
            <p className="mt-1 break-words text-[11px] font-semibold text-[#526275]">
              {value ?? "—"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {signals.map(([label, found, evidence]) => (
          <EvidenceSignal
            key={label}
            label={label}
            found={found}
            evidence={evidence}
          />
        ))}
      </div>
      {!!audit.primaryCtaText?.length && (
        <div className="mt-3 rounded-lg border border-[#eef1f4] bg-[#fbfcfd] p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[.06em] text-[#9aa6b4]">
            Primary CTA text
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#526275]">
            {audit.primaryCtaText.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

type ImportResult = {
  rawCount: number;
  rawPreview: Record<string, string | null>[];
  duplicates: Lead[];
  unique: Lead[];
  errors: string[];
  columns: string[];
  report: ImportReport;
};

function buildImportReport(
  rawRows: number,
  invalidRows: number,
  unique: Lead[],
  duplicates: Lead[],
  duplicateReasonCounts: DedupeReasonCounts,
): ImportReport {
  return {
    rawRows,
    invalidRows,
    duplicatesFound: duplicates.length,
    uniqueImported: unique.length,
    withWebsite: unique.filter((lead) => lead.hasWebsite).length,
    noWebsite: unique.filter((lead) => !lead.hasWebsite).length,
    duplicateReasonCounts,
  };
}

function ImportReportCard({
  report,
  title = "Last import report",
}: {
  report: ImportReport;
  title?: string;
}) {
  const dedupeRows = [
    ["place_id", report.duplicateReasonCounts.place_id],
    ["phone", report.duplicateReasonCounts.phone],
    ["website/domain", report.duplicateReasonCounts["website/domain"]],
    [
      "normalized name + address",
      report.duplicateReasonCounts["normalized name + address"],
    ],
  ];
  return (
    <div className="rounded-xl border border-[#bfeaf2] bg-[#f4fdff] p-4 shadow-[0_2px_8px_rgba(15,35,58,.02)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            {title}
          </p>
          <p className="mt-1 text-xs text-[#627889]">
            Counts are calculated from unique imported rows only; demo records
            are excluded.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.06em] text-[#147389] ring-1 ring-[#d5eef2]">
          <Check size={12} /> Production import
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ReportMetric label="Raw rows" value={report.rawRows} />
        <ReportMetric
          label="Invalid rows"
          value={report.invalidRows}
          tone={report.invalidRows ? "amber" : "default"}
        />
        <ReportMetric
          label="Duplicates"
          value={report.duplicatesFound}
          tone={report.duplicatesFound ? "amber" : "default"}
        />
        <ReportMetric
          label="Unique imported"
          value={report.uniqueImported}
          tone="green"
        />
        <ReportMetric label="With website" value={report.withWebsite} />
        <ReportMetric
          label="No website"
          value={report.noWebsite}
          tone="amber"
        />
        {report.added !== undefined && <ReportMetric label="Added to workspace" value={report.added} tone="green" />}
        {report.duplicatesAgainstWorkspace !== undefined && <ReportMetric label="Existing duplicates" value={report.duplicatesAgainstWorkspace} tone="amber" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#dceff2] pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7c919b]">
          Deduplication reasons
        </span>
        {dedupeRows.map(([label, count]) => (
          <span key={label} className="text-[11px] text-[#637b87]">
            <span className="font-bold text-[#2d5360]">{count}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "green";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-[#176b7d]";
  return (
    <div className="rounded-lg border border-white/80 bg-white px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[.07em] text-[#8b9ca5]">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold", toneClass)}>{value}</p>
    </div>
  );
}
function ImportModal({
  onClose,
  onImport,
  existingLeadCount,
}: {
  onClose: () => void;
  onImport: (leads: Lead[], report: ImportReport, mode: ImportMode) => void | Promise<void>;
  existingLeadCount: number;
}) {
  const [stage, setStage] = useState<"upload" | "preview" | "done">("upload");
  const [mode, setMode] = useState<ImportMode>("APPEND");
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  function handleFile(file?: File) {
    if (!file) return;
    void file.text().then((text) => {
      const rows = parseCsv(text);
      const normalized = normalizeRows(rows, file.name);
      const deduped = deduplicateLeads(normalized.leads);
      const report = buildImportReport(
        rows.length,
        normalized.errors.length,
        deduped.unique,
        deduped.duplicates,
        deduped.duplicateReasonCounts,
      );
      setFileName(file.name);
      setResult({
        rawCount: rows.length,
        rawPreview: rows.slice(0, 3),
        duplicates: deduped.duplicates,
        unique: deduped.unique,
        errors: normalized.errors,
        columns: rows[0] ? Object.keys(rows[0]) : [],
        report,
      });
      setStage("preview");
    });
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#07111f]/45 p-4 backdrop-blur-sm">
      <div className="animate-fade-in w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_18px_60px_rgba(10,22,40,.2)]">
        <div className="flex items-center justify-between border-b border-[#e8edf1] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
              Lead ingestion
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-[-.03em] text-[#17243a]">
              Import a CSV file
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a96a5] hover:bg-[#f5f7fa]"
          >
            <X size={17} />
          </button>
        </div>
        {stage === "upload" && (
          <div className="p-6">
            <div className="rounded-xl border-2 border-dashed border-[#cceef4] bg-[#f7fdfe] p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5faff] text-[#00aaca]">
                <Upload size={21} />
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#27364b]">
                Drop your lead export here
              </h3>
              <p className="mt-1 text-xs text-[#8793a4]">
                CSV files with name, address, phone, rating, website, and source
                fields.
              </p>
              <label className="mx-auto mt-5 flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-[#0a1628] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#10223b]">
                <Upload size={14} /> Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  className="hidden"
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <ImportStep number="01" label="Upload" active />
              <ImportStep number="02" label="Review" />
              <ImportStep number="03" label="Import" />
            </div>
          </div>
        )}
        {stage === "preview" && result && (
          <div className="p-6">
            <div className="flex items-center justify-between rounded-lg border border-[#e8edf1] bg-[#fbfcfd] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText size={17} className="shrink-0 text-[#00aaca]" />
                <span className="truncate text-xs font-bold text-[#27364b]">
                  {fileName}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#8793a4]">
                {result.columns.length} columns detected
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ImportStat label="Raw rows" value={result.rawCount} />
              <ImportStat
                label="Duplicates"
                value={result.duplicates.length}
                tone="amber"
              />
              <ImportStat
                label="Unique import"
                value={result.unique.length}
                tone="green"
              />
              <ImportStat
                label="Errors"
                value={result.errors.length}
                tone={result.errors.length ? "red" : "green"}
              />
            </div>
            <div className="mt-5 rounded-lg border border-[#eef1f4] p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#27364b]">
                  Detected columns
                </p>
                <span className="text-[10px] text-[#8793a4]">
                  Raw values will be preserved
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.columns.map((column) => (
                  <span
                    key={column}
                    className="rounded-md bg-[#f5f7fa] px-2 py-1 text-[10px] font-medium text-[#637286]"
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3.5">
              <p className="text-xs font-bold text-amber-800">Import behavior</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["APPEND", "REPLACE"] as ImportMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={cn("rounded-md border px-3 py-1.5 text-[10px] font-bold", mode === option ? "border-[#00aaca] bg-white text-[#08758b]" : "border-amber-200 text-amber-700")}
                  >
                    {option === "APPEND" ? "APPEND LEADS" : "REPLACE WORKSPACE"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-amber-700">
                {mode === "APPEND" ? "Existing production leads are preserved and incoming rows are deduplicated against them." : `This will replace ${existingLeadCount} existing leads and their audits. Confirmation is required.`}
              </p>
            </div>
            {result.rawPreview.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg border border-[#eef1f4]">
                <div className="flex items-center justify-between border-b border-[#eef1f4] bg-[#fbfcfd] px-3.5 py-2.5">
                  <p className="text-xs font-bold text-[#27364b]">
                    Raw row preview
                  </p>
                  <span className="text-[10px] text-[#8793a4]">
                    First {result.rawPreview.length} rows
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] border-collapse">
                    <thead className="border-b border-[#eef1f4]">
                      <tr>
                        {result.columns.slice(0, 4).map((column) => (
                          <th
                            key={column}
                            className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-[.08em] text-[#98a3b1]"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f5]">
                      {result.rawPreview.map((row, rowIndex) => (
                        <tr key={`raw-${rowIndex}`}>
                          {result.columns.slice(0, 4).map((column) => (
                            <td
                              key={column}
                              className="max-w-[150px] truncate px-3 py-2 text-[10px] text-[#637286]"
                            >
                              {row[column] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700">
                <p className="font-bold">Rows needing attention</p>
                <p className="mt-1">
                  {result.errors.slice(0, 3).join(" · ")}
                  {result.errors.length > 3
                    ? ` · +${result.errors.length - 3} more`
                    : ""}
                </p>
              </div>
            )}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStage("upload")}
                className="text-xs font-semibold text-[#718096] hover:text-[#27364b]"
              >
                Choose another file
              </button>
              <button
                onClick={async () => {
                  if (mode === "REPLACE" && !window.confirm(`Replace the production workspace? ${existingLeadCount} leads and their audits will be removed.`)) return;
                  try {
                    setImportError(null);
                    await onImport(result.unique, result.report, mode);
                    setStage("done");
                  } catch (error) {
                    setImportError(error instanceof Error ? error.message : "Import failed");
                  }
                }}
                disabled={!result.unique.length}
                className="flex items-center gap-2 rounded-lg bg-[#00bce3] px-4 py-2.5 text-xs font-bold text-[#06273a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === "REPLACE" ? "Replace workspace" : `Append ${result.unique.length} leads`} <Check size={14} />
              </button>
            </div>
            {importError && <p className="mt-3 text-right text-[11px] font-semibold text-rose-600">{importError}</p>}
          </div>
        )}
        {stage === "done" && (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={22} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#17243a]">
              Import complete
            </h3>
            <p className="mt-2 text-sm text-[#718096]">
              {result?.unique.length ?? 0} unique leads are now in your
              workspace.
            </p>
            {result && (
              <div className="mt-6 text-left">
                <ImportReportCard
                  report={result.report}
                  title="Import report"
                />
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-[#0a1628] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Back to leads
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function ImportStep({
  number,
  label,
  active,
}: {
  number: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold text-[#a1acb8]",
        active && "text-[#00aaca]",
      )}
    >
      <span className="mr-1 font-bold">{number}</span>
      {label}
    </div>
  );
}
function ImportStat({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: number;
  tone?: "cyan" | "amber" | "green" | "red";
}) {
  const colors = {
    cyan: "text-[#00aaca] bg-[#effcff]",
    amber: "text-amber-600 bg-amber-50",
    green: "text-emerald-600 bg-emerald-50",
    red: "text-rose-600 bg-rose-50",
  };
  return (
    <div className="rounded-lg border border-[#eef1f4] p-3">
      <p className="text-[10px] font-semibold text-[#8793a4]">{label}</p>
      <p
        className={cn(
          "mt-1 inline-flex rounded-md px-1.5 py-0.5 text-lg font-bold",
          colors[tone],
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Preview Studio View ──────────────────────────────────────────────────────

type V0WorkflowStatusUI =
  | "NOT_STARTED"
  | "BRIEF_READY"
  | "PROMPT_READY"
  | "IN_V0"
  | "PREVIEW_LINK_ADDED"
  | "READY_FOR_OUTREACH"
  | "ARCHIVED"
  // legacy
  | "DRAFT"
  | "READY";

interface PreviewStudioRowState {
  leadId: string;
  previewId: string | null;
  workflowStatus: V0WorkflowStatusUI | null;
  legacyStatus: string | null;
  slug: string | null;
  finalPreviewUrl: string | null;
  hasPrompt: boolean;
  hasAssets: boolean;
  loading: boolean;
  error: string | null;
}

function v0StatusTone(status: V0WorkflowStatusUI | null): string {
  if (status === "READY_FOR_OUTREACH") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "PREVIEW_LINK_ADDED") return "bg-teal-50 text-teal-700 border-teal-100";
  if (status === "IN_V0") return "bg-violet-50 text-violet-700 border-violet-100";
  if (status === "PROMPT_READY") return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (status === "BRIEF_READY") return "bg-sky-50 text-sky-700 border-sky-100";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-500 border-slate-200";
  if (status === "DRAFT" || status === "READY") return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

function v0StatusLabel(status: V0WorkflowStatusUI | null): string {
  if (!status || status === "NOT_STARTED") return "Not Started";
  if (status === "BRIEF_READY") return "Brief Ready";
  if (status === "PROMPT_READY") return "Prompt Ready";
  if (status === "IN_V0") return "In v0";
  if (status === "PREVIEW_LINK_ADDED") return "URL Added";
  if (status === "READY_FOR_OUTREACH") return "Ready";
  if (status === "ARCHIVED") return "Archived";
  if (status === "DRAFT") return "Draft (Legacy)";
  if (status === "READY") return "Ready (Legacy)";
  return status;
}

function slugPathSegment(slug: string | null): string {
  if (!slug) return "";
  const parts = slug.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? slug;
}

// ── V0 Prompt Drawer ─────────────────────────────────────────

interface V0PromptData {
  masterPrompt: string;
  sections: Array<{ key: string; label: string; content: string }>;
  copyPack: {
    headline: string;
    subheadline: string;
    primaryCTA: string;
    secondaryCTA: string;
    trustCopy: string;
    serviceTitles: string[];
    locationCTA: string;
    finalCTA: string;
  };
  archetype: string;
  archetypeReason: string;
  designReferences: Array<{ name: string; url: string; purpose: string }>;
  sectionBlueprint: string[];
}

interface VerifiedFactsData {
  businessName: string;
  city: string;
  country: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  verifiedBookingUrl: string | null;
  verifiedServices: string[];
  verifiedTeamInfo: string[];
  mainProblem: string | null;
  outreachAngle: string | null;
  recommendedCTA: string | null;
  currentWebsite: string | null;
  websiteTitle: string | null;
}

interface AssetData {
  logoUrl: { url: string; confidence: string } | null;
  ogImageUrl: { url: string; confidence: string } | null;
  currentWebsiteScreenshotUrl: { url: string; confidence: string } | null;
  heroImageCandidates: Array<{ url: string; type: string; confidence: string }>;
  faviconUrl: { url: string; confidence: string } | null;
  totalAssets: number;
  sourceWebsite: string | null;
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  function copyText(text: string, id: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }
  return { copied, copyText };
}

function CopyButton({
  text,
  id,
  label = "Copy",
}: {
  text: string;
  id: string;
  label?: string;
}) {
  const { copied, copyText } = useCopyToClipboard();
  return (
    <button
      onClick={() => copyText(text, id)}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition",
        copied === id
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#e2e8ee] bg-white text-[#526275] hover:bg-[#f5f7fa]",
      )}
    >
      {copied === id ? <Check size={12} /> : <Copy size={12} />}
      {copied === id ? "Copied!" : label}
    </button>
  );
}

function V0PromptDrawer({
  leadName,
  previewId,
  onClose,
  onGeneratePrompt,
}: {
  leadName: string;
  previewId: string;
  onClose: () => void;
  onGeneratePrompt?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promptData, setPromptData] = useState<V0PromptData | null>(null);
  const [factsData, setFactsData] = useState<VerifiedFactsData | null>(null);
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [activeTab, setActiveTab] = useState<"prompt" | "facts" | "copy" | "assets">("prompt");

  useEffect(() => {
    void fetch(`/api/preview/${previewId}`)
      .then((r) => r.json() as Promise<{ record?: { v0PromptPack?: V0PromptData; verifiedFacts?: VerifiedFactsData; assetPack?: AssetData }; error?: string }>)
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        if (data.record?.v0PromptPack) {
          setPromptData(data.record.v0PromptPack as V0PromptData);
        }
        if (data.record?.verifiedFacts) {
          setFactsData(data.record.verifiedFacts as VerifiedFactsData);
        }
        if (data.record?.assetPack) {
          setAssetData(data.record.assetPack as AssetData);
        }
      })
      .catch(() => setError("Failed to load prompt pack"))
      .finally(() => setLoading(false));
  }, [previewId]);

  const DESIGN_REFS = [
    { name: "WebDentts", url: "https://webdentts.vercel.app/", purpose: "Visual benchmark" },
    { name: "Ktabna", url: "https://ktabna.shop/ar", purpose: "Conversion hierarchy" },
    { name: "Breezy Tech", url: "https://breezy-tech-hvac-l0luur96y-saifs-projects-afa1e7df.vercel.app/", purpose: "Local CTA clarity" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex">
      <button
        aria-label="Close prompt drawer"
        className="flex-1 bg-[#07111f]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="flex h-full w-full max-w-[720px] flex-col bg-white shadow-[−16px_0_60px_rgba(10,22,40,.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8edf1] px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">V0 Prompt Pack</p>
            <h2 className="mt-0.5 text-base font-bold tracking-[-.03em] text-[#17243a]">{leadName}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a96a5] hover:bg-[#f5f7fa]">
            <X size={17} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#edf1f5] px-6">
          {(["prompt", "facts", "copy", "assets"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "mr-5 border-b-2 py-3 text-[11px] font-semibold capitalize transition",
                activeTab === tab
                  ? "border-[#00aaca] text-[#00aaca]"
                  : "border-transparent text-[#8a96a5] hover:text-[#27364b]",
              )}
            >
              {tab === "prompt" ? "V0 Master Prompt" : tab === "facts" ? "Verified Facts" : tab === "copy" ? "Copy Pack" : "Assets"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#8793a4]">
              <Activity size={14} className="animate-spin" /> Loading prompt pack…
            </div>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}

          {!loading && !error && (
            <>
              {/* V0 Master Prompt tab */}
              {activeTab === "prompt" && (
                <div>
                  {promptData ? (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#27364b]">Complete V0 Prompt</p>
                          <p className="text-[10px] text-[#8793a4] mt-0.5">Copy and paste directly into v0.app</p>
                        </div>
                        <CopyButton text={promptData.masterPrompt} id="master-prompt" label="Copy Full Prompt" />
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-[#e8edf1] bg-[#f8fafc] p-4 text-[10px] leading-relaxed text-[#374151] whitespace-pre-wrap font-mono">
                        {promptData.masterPrompt}
                      </pre>
                      <div className="mt-4 rounded-xl border border-[#e8edf1] bg-[#f8fafc] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8793a4] mb-3">Design References</p>
                        <div className="space-y-2">
                          {DESIGN_REFS.map((ref) => (
                            <a key={ref.name} href={ref.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-[#edf1f5] bg-white px-3 py-2 text-[11px] hover:border-[#00aaca] transition">
                              <ExternalLink size={11} className="text-[#00aaca] shrink-0" />
                              <span className="font-semibold text-[#27364b]">{ref.name}</span>
                              <span className="text-[#8793a4]">{ref.purpose}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-amber-700 font-semibold mb-3">No V0 Prompt found for this lead.</p>
                      {onGeneratePrompt ? (
                        <button
                          onClick={() => {
                            setLoading(true);
                            setError(null);
                            onGeneratePrompt().finally(() => onClose());
                          }}
                          className="flex items-center gap-1 rounded-lg bg-[#00aaca] px-3 py-2 text-[11px] font-bold text-[#06273a]"
                        >
                          <Sparkles size={11} /> Generate V0 Prompt
                        </button>
                      ) : (
                        <p className="text-xs text-amber-700">Use "Generate Prompt" action first.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Verified Facts tab */}
              {activeTab === "facts" && (
                <div>
                  {factsData ? (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs font-bold text-[#27364b]">Verified Business Facts</p>
                        <CopyButton
                          text={JSON.stringify(factsData, null, 2)}
                          id="facts-copy"
                          label="Copy JSON"
                        />
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: "Business Name", value: factsData.businessName },
                          { label: "City", value: factsData.city || "—" },
                          { label: "Country", value: factsData.country || "—" },
                          { label: "Website", value: factsData.currentWebsite || "—" },
                          { label: "Page Title", value: factsData.websiteTitle || "—" },
                          {
                            label: "Google Rating",
                            value: factsData.googleRating != null
                              ? `${factsData.googleRating.toFixed(1)}${factsData.reviewCount != null ? ` · ${factsData.reviewCount.toLocaleString()} reviews` : ""}`
                              : "—",
                          },
                          { label: "Phone", value: factsData.phone || "—" },
                          { label: "WhatsApp", value: factsData.whatsapp || "—" },
                          { label: "Email", value: factsData.email || "—" },
                          { label: "Booking URL", value: factsData.verifiedBookingUrl || "—" },
                          { label: "Main Problem", value: factsData.mainProblem || "—" },
                          { label: "Outreach Angle", value: factsData.outreachAngle || "—" },
                          { label: "Recommended CTA", value: factsData.recommendedCTA || "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex gap-3 rounded-lg border border-[#edf1f5] px-3 py-2">
                            <span className="w-32 shrink-0 text-[10px] font-semibold text-[#8793a4]">{label}</span>
                            <span className="text-[11px] text-[#27364b] break-all">{value}</span>
                          </div>
                        ))}
                        {factsData.verifiedServices.length > 0 && (
                          <div className="rounded-lg border border-[#edf1f5] px-3 py-2">
                            <p className="text-[10px] font-semibold text-[#8793a4] mb-2">Verified Services</p>
                            <div className="flex flex-wrap gap-1.5">
                              {factsData.verifiedServices.map((s) => (
                                <span key={s} className="rounded-md bg-[#f0f9ff] border border-[#bae6fd] px-2 py-0.5 text-[10px] text-[#0369a1]">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
                      No brief generated yet. Use "Generate Brief" action first.
                    </div>
                  )}
                </div>
              )}

              {/* Copy Pack tab */}
              {activeTab === "copy" && (
                <div>
                  {promptData?.copyPack ? (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs font-bold text-[#27364b]">Copy Pack</p>
                        <CopyButton
                          text={Object.entries(promptData.copyPack)
                            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                            .join("\n")}
                          id="copy-pack"
                          label="Copy All"
                        />
                      </div>
                      <div className="space-y-3">
                        {([
                          ["Headline", promptData.copyPack.headline],
                          ["Subheadline", promptData.copyPack.subheadline],
                          ["Primary CTA", promptData.copyPack.primaryCTA],
                          ["Secondary CTA", promptData.copyPack.secondaryCTA],
                          ["Trust Copy", promptData.copyPack.trustCopy],
                          ["Location CTA", promptData.copyPack.locationCTA],
                          ["Final CTA", promptData.copyPack.finalCTA],
                        ] as [string, string][]).map(([label, value]) => (
                          <div key={label} className="group relative rounded-lg border border-[#edf1f5] px-3 py-2">
                            <p className="text-[10px] font-semibold text-[#8793a4]">{label}</p>
                            <p className="mt-0.5 text-[11px] text-[#27364b]">&quot;{value}&quot;</p>
                          </div>
                        ))}
                        {promptData.copyPack.serviceTitles.length > 0 && (
                          <div className="rounded-lg border border-[#edf1f5] px-3 py-2">
                            <p className="text-[10px] font-semibold text-[#8793a4] mb-1.5">Service Titles</p>
                            <div className="flex flex-wrap gap-1.5">
                              {promptData.copyPack.serviceTitles.map((s) => (
                                <span key={s} className="rounded-md bg-[#f5f7fa] px-2 py-0.5 text-[10px] text-[#526275]">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="rounded-xl border border-[#e8edf1] bg-[#f8fafc] p-3">
                          <p className="text-[10px] font-bold text-[#27364b] mb-2">
                            Archetype: {promptData.archetype}
                          </p>
                          <p className="text-[10px] text-[#8793a4]">{promptData.archetypeReason}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
                      No prompt generated yet. Use "Generate Prompt" action first.
                    </div>
                  )}
                </div>
              )}

              {/* Assets tab */}
              {activeTab === "assets" && (
                <div>
                  {assetData ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold text-[#27364b]">
                          Assets ({assetData.totalAssets} found)
                        </p>
                        {assetData.sourceWebsite && (
                          <a href={assetData.sourceWebsite} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-[#00aaca] hover:underline">
                            <ExternalLink size={10} /> Current website
                          </a>
                        )}
                      </div>
                      <div className="space-y-2">
                        {assetData.currentWebsiteScreenshotUrl && (
                          <div className="rounded-lg border border-[#edf1f5] overflow-hidden">
                            <p className="bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold text-[#8793a4]">Current Website Screenshot</p>
                            <a href={assetData.currentWebsiteScreenshotUrl.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 text-[10px] text-[#526275] hover:text-[#00aaca]">
                              <ExternalLink size={10} />
                              <span className="truncate">{assetData.currentWebsiteScreenshotUrl.url}</span>
                              <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold",
                                assetData.currentWebsiteScreenshotUrl.confidence === "HIGH" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                                {assetData.currentWebsiteScreenshotUrl.confidence}
                              </span>
                            </a>
                          </div>
                        )}
                        {assetData.logoUrl && (
                          <AssetRow label="Logo" asset={assetData.logoUrl} />
                        )}
                        {assetData.ogImageUrl && (
                          <AssetRow label="OG Image" asset={assetData.ogImageUrl} />
                        )}
                        {assetData.faviconUrl && (
                          <AssetRow label="Favicon" asset={assetData.faviconUrl} />
                        )}
                        {assetData.heroImageCandidates.length > 0 && (
                          <div className="rounded-lg border border-[#edf1f5]">
                            <p className="bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold text-[#8793a4]">Hero Image Candidates</p>
                            {assetData.heroImageCandidates.map((a, i) => (
                              <AssetRow key={i} label={`#${i + 1} ${a.type}`} asset={a} />
                            ))}
                          </div>
                        )}
                        {assetData.totalAssets === 0 && (
                          <p className="text-xs text-[#8793a4]">No verified assets found. Use stock imagery in v0.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
                      No asset pack generated yet. Use "Generate Brief" action first.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetRow({
  label,
  asset,
}: {
  label: string;
  asset: { url: string; confidence: string };
}) {
  return (
    <div className="flex items-center gap-2 border-t border-[#edf1f5] px-3 py-2 first:border-t-0">
      <span className="w-20 shrink-0 text-[10px] font-semibold text-[#8793a4]">{label}</span>
      <a href={asset.url} target="_blank" rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1 text-[10px] text-[#526275] hover:text-[#00aaca]">
        <ExternalLink size={9} className="shrink-0" />
        <span className="truncate">{asset.url}</span>
      </a>
      <span className={cn("ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0",
        asset.confidence === "HIGH" ? "bg-emerald-50 text-emerald-700" : asset.confidence === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500")}>
        {asset.confidence}
      </span>
    </div>
  );
}

// ── Add Preview URL Modal ─────────────────────────────────────

function AddPreviewUrlModal({
  previewId,
  onClose,
  onSuccess,
}: {
  previewId: string;
  onClose: () => void;
  onSuccess: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) { setError("Please enter a URL"); return; }
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) { setError("URL must start with http or https"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_preview_url", previewId, finalPreviewUrl: trimmed }),
      });
      const data = await res.json() as { updated?: boolean; error?: string };
      if (!res.ok || !data.updated) throw new Error(data.error ?? "Failed to save URL");
      onSuccess(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save URL");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#07111f]/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_60px_rgba(10,22,40,.2)]">
        <div className="flex items-center justify-between border-b border-[#e8edf1] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">Preview Studio</p>
            <h2 className="mt-0.5 text-sm font-bold text-[#17243a]">Add v0 Preview URL</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a96a5] hover:bg-[#f5f7fa]">
            <X size={17} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
          <p className="text-xs text-[#526275] mb-4">
            Paste the final deployed preview URL from v0.app. Only the owner can approve this as outreach-ready.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://some-preview.vercel.app"
            className="w-full rounded-xl border border-[#dde3ea] px-3.5 py-3 text-sm text-[#27364b] placeholder-[#b0bbc8] focus:border-[#00aaca] focus:outline-none"
            autoFocus
          />
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0a1628] py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {submitting ? <><Activity size={12} className="animate-spin" /> Saving…</> : <><Link size={12} /> Save Preview URL</>}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-[#e2e8ee] px-4 py-2.5 text-xs font-semibold text-[#526275] hover:bg-[#f5f7fa]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Preview Studio View ──────────────────────────────────

function PreviewStudioView({
  leads,
  onOpenLead,
  ensureAdminSession,
}: {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  ensureAdminSession: () => Promise<boolean>;
}) {
  const [rowStates, setRowStates] = useState<Record<string, PreviewStudioRowState>>({});
  const [drawerLeadName, setDrawerLeadName] = useState<string | null>(null);
  const [drawerPreviewId, setDrawerPreviewId] = useState<string | null>(null);
  const [addUrlPreviewId, setAddUrlPreviewId] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ── Initial hydration: load all persisted preview records from the DB on mount ──
  useEffect(() => {
    void fetch("/api/preview")
      .then((r) => r.json() as Promise<{ records?: Record<string, unknown>[] }>)
      .then((data) => {
        if (!data.records) return;
        setRowStates((prev) => {
          const next = { ...prev };
          for (const rec of data.records!) {
            const leadId = String(rec.lead_id ?? rec.leadId ?? "");
            if (!leadId) continue;
            // Build state from persisted record — same logic as applyRecord
            let ws = String(rec.workflow_status ?? rec.workflowStatus ?? "");
            const legacy = String(rec.status ?? "");
            const promptObj = rec.v0PromptPack;
            const hasPrompt = Boolean(promptObj && typeof promptObj === "object" && Object.keys(promptObj as object).length > 0);
            const assetObj = rec.assetPack;
            const hasAssets = Boolean(assetObj && typeof assetObj === "object" && Object.keys(assetObj as object).length > 0);
            const finalUrl = rec.finalPreviewUrl ? String(rec.finalPreviewUrl) : null;
            if (!ws || ws === "undefined" || ws === "null" || ws === "NOT_STARTED") {
              if (legacy === "READY") ws = finalUrl ? "READY_FOR_OUTREACH" : (hasPrompt ? "PROMPT_READY" : "BRIEF_READY");
              else if (legacy === "DRAFT") ws = hasPrompt ? "PROMPT_READY" : "BRIEF_READY";
              else ws = "NOT_STARTED";
            }
            next[leadId] = {
              leadId,
              previewId: String(rec.id ?? "") || null,
              workflowStatus: ws as V0WorkflowStatusUI,
              legacyStatus: legacy || null,
              slug: String(rec.slug ?? "") || null,
              finalPreviewUrl: finalUrl,
              hasPrompt,
              hasAssets,
              loading: false,
              error: null,
            };
          }
          return next;
        });
      })
      .catch(() => { /* silent – rowStates stay empty, user can still trigger actions */ })
      .finally(() => setHydrated(true));
  }, []);

  const eligibleLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const q = lead.qualificationStatus;
        const m = lead.manualDecision;
        // SKIP excluded unless manually overridden
        if (q === "SKIP" && m !== "QUALIFY") return false;
        return (
          q === "QUALIFIED" ||
          m === "QUALIFY" ||
          q === "HOLD"
        );
      })
      .sort((a, b) => b.score.total - a.score.total);
  }, [leads]);

  const skippedLeads = useMemo(
    () => leads.filter((l) => l.qualificationStatus === "SKIP" && l.manualDecision !== "QUALIFY"),
    [leads],
  );

  function getState(leadId: string): PreviewStudioRowState {
    return rowStates[leadId] ?? {
      leadId,
      previewId: null,
      workflowStatus: null,
      legacyStatus: null,
      slug: null,
      finalPreviewUrl: null,
      hasPrompt: false,
      hasAssets: false,
      loading: false,
      error: null,
    };
  }

  function updateState(leadId: string, updates: Partial<PreviewStudioRowState>) {
    setRowStates((prev) => ({
      ...prev,
      [leadId]: { ...getState(leadId), ...updates },
    }));
  }

  async function callApi(
    leadId: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!(await ensureAdminSession())) return null;
    updateState(leadId, { loading: true, error: null });
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String((data as { error?: string }).error ?? "Request failed"));
      return data;
    } catch (err) {
      updateState(leadId, { error: err instanceof Error ? err.message : "Failed" });
      return null;
    } finally {
      updateState(leadId, { loading: false });
    }
  }

  function applyRecord(leadId: string, rec: Record<string, unknown>) {
    let ws = String(rec.workflow_status ?? rec.workflowStatus ?? "");
    const legacy = String(rec.status ?? "");
    // Check if prompt exists (not null and has keys)
    const promptObj = rec.v0PromptPack;
    const hasPrompt = Boolean(promptObj && typeof promptObj === "object" && Object.keys(promptObj).length > 0);
    const assetObj = rec.assetPack;
    const hasAssets = Boolean(assetObj && typeof assetObj === "object" && Object.keys(assetObj).length > 0);
    const finalUrl = rec.finalPreviewUrl ? String(rec.finalPreviewUrl) : null;

    if (!ws || ws === "undefined" || ws === "null" || ws === "NOT_STARTED") {
      if (legacy === "READY") {
        ws = finalUrl ? "READY_FOR_OUTREACH" : (hasPrompt ? "PROMPT_READY" : "BRIEF_READY");
      } else if (legacy === "DRAFT") {
        ws = hasPrompt ? "PROMPT_READY" : "BRIEF_READY";
      } else {
        ws = "NOT_STARTED";
      }
    }

    updateState(leadId, {
      previewId: String(rec.id ?? "") || null,
      workflowStatus: ws as V0WorkflowStatusUI,
      legacyStatus: legacy || null,
      slug: String(rec.slug ?? "") || null,
      finalPreviewUrl: finalUrl,
      hasPrompt,
      hasAssets,
    });
  }

  async function handleGenerateBrief(lead: Lead) {
    const data = await callApi(lead.leadId, { action: "generate_brief", leadId: lead.leadId });
    if (data?.record) applyRecord(lead.leadId, data.record as Record<string, unknown>);
  }

  async function handleGeneratePrompt(lead: Lead) {
    const state = getState(lead.leadId);
    const data = await callApi(lead.leadId, { action: "generate_prompt", leadId: lead.leadId });
    if (data?.record) {
      applyRecord(lead.leadId, data.record as Record<string, unknown>);
      // Auto-open drawer if we have a previewId
      const rec = data.record as Record<string, unknown>;
      const pid = state.previewId ?? String(rec.id ?? "");
      if (pid) { setDrawerLeadName(lead.name); setDrawerPreviewId(pid); }
    }
  }

  async function handleMarkInV0(leadId: string) {
    const state = getState(leadId);
    if (!state.previewId) return;
    const data = await callApi(leadId, { action: "mark_in_v0", previewId: state.previewId });
    if (data?.updated) updateState(leadId, { workflowStatus: "IN_V0" });
  }

  async function handleMarkReady(leadId: string) {
    const state = getState(leadId);
    if (!state.previewId) return;
    const data = await callApi(leadId, { action: "mark_ready_for_outreach", previewId: state.previewId });
    if (data?.updated) updateState(leadId, { workflowStatus: "READY_FOR_OUTREACH" });
  }

  async function handleArchive(leadId: string) {
    const state = getState(leadId);
    if (!state.previewId) return;
    const data = await callApi(leadId, { action: "archive", previewId: state.previewId });
    if (data?.updated) updateState(leadId, { workflowStatus: "ARCHIVED" });
  }

  const statusOrder: V0WorkflowStatusUI[] = [
    "NOT_STARTED",
    "BRIEF_READY",
    "PROMPT_READY",
    "IN_V0",
    "PREVIEW_LINK_ADDED",
    "READY_FOR_OUTREACH",
    "ARCHIVED",
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#00aaca]">
            Sprint 3A
          </p>
          <h1 className="text-[27px] font-bold tracking-[-.045em] text-[#17243a]">
            Preview Studio
          </h1>
          <p className="mt-1 text-sm text-[#718096]">
            Generate V0 prompt packs, build previews in v0.app, and approve for outreach.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#e9fbff] px-3 py-2">
            <Sparkles size={14} className="text-[#00aaca]" />
            <span className="text-[11px] font-semibold text-[#00aaca]">
              {eligibleLeads.length} eligible leads
            </span>
          </div>
          {skippedLeads.length > 0 && (
            <button
              onClick={() => setShowSkipped((v) => !v)}
              className="rounded-lg border border-[#e2e8ee] px-3 py-2 text-[11px] font-semibold text-[#8793a4] hover:bg-[#f5f7fa]"
            >
              {showSkipped ? "Hide" : "Show"} {skippedLeads.length} skipped
            </button>
          )}
        </div>
      </div>

      {/* Workflow legend */}
      <div className="flex flex-wrap gap-2">
        {statusOrder.map((s) => (
          <span key={s} className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[.06em]", v0StatusTone(s))}>
            {v0StatusLabel(s)}
          </span>
        ))}
      </div>

      {/* Main table */}
      <div className="overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-[0_2px_8px_rgba(15,35,58,.025)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead className="border-b border-[#edf1f4] bg-[#fbfcfd]">
              <tr>
                {[
                  "Business",
                  "Qualification",
                  "Priority",
                  "Main Problem",
                  "Score",
                  "Depth / Archetype",
                  "Assets",
                  "Workflow Status",
                  "Preview URL",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[.08em] text-[#8390a0]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {eligibleLeads.map((lead) => {
                const state = getState(lead.leadId);
                const qResult = lead.audit.qualitativeResult;
                const depth = qResult?.recommendedPreviewDepth ?? "—";
                const mainProblem = lead.audit.mainProblem ?? qResult?.mainProblem ?? "—";
                const opportunityScore = qResult?.websiteOpportunityScore ?? null;
                const isHold = lead.qualificationStatus === "HOLD";
                const isLoading = state.loading;
                const ws = state.workflowStatus;
                const hasPrompt = state.hasPrompt;
                const hasBrief = ws && ws !== "NOT_STARTED" && ws !== "ARCHIVED";
                const finalUrl = state.finalPreviewUrl;
                const isLegacyRecord = ws === "DRAFT" || ws === "READY";

                return (
                  <tr key={lead.leadId} className="hover:bg-[#fbfdfe]">
                    {/* Business */}
                    <td className="px-3 py-3">
                      <button onClick={() => onOpenLead(lead)} className="text-left">
                        <p className="text-xs font-bold text-[#27364b] hover:text-[#00aaca]">{lead.name}</p>
                        <p className="mt-0.5 text-[10px] text-[#8a96a5] truncate max-w-[160px]">{lead.category}</p>
                      </button>
                      {isHold && (
                        <span className="mt-0.5 inline-block text-[9px] font-bold uppercase text-amber-500">hold</span>
                      )}
                    </td>
                    {/* Qualification */}
                    <td className="px-3 py-3">
                      <StatusPill value={lead.qualificationStatus} compact />
                    </td>
                    {/* Priority */}
                    <td className="px-3 py-3">
                      <PriorityPill value={lead.score.priority} provisional={!lead.score.isFinal} />
                    </td>
                    {/* Main Problem */}
                    <td className="px-3 py-3">
                      <p className="text-[10px] text-[#526275] max-w-[180px] line-clamp-2">{mainProblem}</p>
                    </td>
                    {/* Score */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-bold text-[#27364b]">
                        {opportunityScore != null ? opportunityScore : lead.score.total}
                      </span>
                      <span className="ml-1 text-[9px] text-[#8793a4]">
                        {opportunityScore != null ? "/100" : "/100"}
                      </span>
                    </td>
                    {/* Depth / Archetype */}
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.06em]",
                        depth === "PREMIUM" ? "bg-violet-50 text-violet-700 border-violet-100"
                          : depth === "STRONG" ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                          : depth === "LIGHT" ? "bg-sky-50 text-sky-700 border-sky-100"
                          : "bg-slate-50 text-slate-500 border-slate-200",
                      )}>{depth}</span>
                    </td>
                    {/* Assets */}
                    <td className="px-3 py-3">
                      <span className="text-[10px] text-[#8793a4]">
                        {state.hasAssets ? "✓ Ready" : "—"}
                      </span>
                    </td>
                    {/* Workflow Status */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[.05em]",
                          v0StatusTone(ws),
                        )}>
                          {v0StatusLabel(ws)}
                        </span>
                        {isLegacyRecord && (
                          <span className="text-[9px] text-[#b0bbc8] italic">Legacy</span>
                        )}
                        {state.error && (
                          <p className="text-[9px] text-rose-500 max-w-[140px] truncate">{state.error}</p>
                        )}
                      </div>
                    </td>
                    {/* Preview URL */}
                    <td className="px-3 py-3">
                      {finalUrl ? (
                        <a
                          href={finalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#00aaca] hover:underline max-w-[160px] truncate"
                        >
                          <ExternalLink size={9} />
                          {finalUrl.replace(/^https?:\/\//, "").slice(0, 28)}{finalUrl.length > 38 ? "…" : ""}
                        </a>
                      ) : (
                        <span className="text-[10px] text-[#b0bbc8]">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* 1. NOT_STARTED -> Generate Brief */}
                        {(!ws || ws === "NOT_STARTED") && (
                          <button
                            onClick={() => void handleGenerateBrief(lead)}
                            disabled={isLoading || !qResult}
                            className="flex items-center gap-1 rounded-lg bg-[#0a1628] px-2 py-1.5 text-[9px] font-bold text-white disabled:opacity-40"
                          >
                            {isLoading ? <Activity size={9} className="animate-spin" /> : <FileText size={9} />}
                            Generate Brief
                          </button>
                        )}

                        {/* 2. BRIEF_READY -> Generate Prompt */}
                        {ws === "BRIEF_READY" && (
                          <button
                            onClick={() => void handleGeneratePrompt(lead)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg bg-[#00aaca] px-2 py-1.5 text-[9px] font-bold text-[#06273a] disabled:opacity-40"
                          >
                            {isLoading ? <Activity size={9} className="animate-spin" /> : <Sparkles size={9} />}
                            Generate Prompt
                          </button>
                        )}

                        {/* 3. PROMPT_READY -> View Pack, In V0 */}
                        {(ws === "PROMPT_READY" || ws === "IN_V0") && state.previewId && (
                          <button
                            onClick={() => { setDrawerLeadName(lead.name); setDrawerPreviewId(state.previewId!); }}
                            className="flex items-center gap-1 rounded-lg border border-[#e2e8ee] px-2 py-1.5 text-[9px] font-semibold text-[#526275] hover:bg-[#f5f7fa]"
                          >
                            <FileText size={9} /> View Pack
                          </button>
                        )}

                        {ws === "PROMPT_READY" && (
                          <button
                            onClick={() => void handleMarkInV0(lead.leadId)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[9px] font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                          >
                            <Zap size={9} /> In v0
                          </button>
                        )}

                        {/* 4. IN_V0 -> Add URL */}
                        {ws === "IN_V0" && state.previewId && (
                          <button
                            onClick={() => setAddUrlPreviewId(state.previewId!)}
                            className="flex items-center gap-1 rounded-lg border border-[#e2e8ee] px-2 py-1.5 text-[9px] font-semibold text-[#526275] hover:bg-[#f5f7fa]"
                          >
                            <Link size={9} /> Add URL
                          </button>
                        )}

                        {/* 5. PREVIEW_LINK_ADDED -> Open Preview, Approve */}
                        {(ws === "PREVIEW_LINK_ADDED" || ws === "READY_FOR_OUTREACH") && finalUrl && (
                          <a
                            href={finalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-[#00aaca]/30 bg-[#e9fbff] px-2 py-1.5 text-[9px] font-bold text-[#00aaca]"
                          >
                            <ExternalLink size={9} /> Open
                          </a>
                        )}

                        {ws === "PREVIEW_LINK_ADDED" && (
                          <button
                            onClick={() => void handleMarkReady(lead.leadId)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-bold text-white disabled:opacity-40"
                          >
                            <Check size={9} /> Approve
                          </button>
                        )}

                        {/* Archive action (available everywhere except NOT_STARTED and ARCHIVED) */}
                        {ws && ws !== "NOT_STARTED" && ws !== "ARCHIVED" && (
                          <button
                            onClick={() => void handleArchive(lead.leadId)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg border border-[#e2e8ee] px-2 py-1.5 text-[9px] font-semibold text-[#8793a4] hover:bg-[#f5f7fa] disabled:opacity-40"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Skipped leads (shown when toggled) */}
              {showSkipped && skippedLeads.map((lead) => (
                <tr key={lead.leadId} className="opacity-50">
                  <td className="px-3 py-2">
                    <p className="text-[10px] font-semibold text-[#27364b]">{lead.name}</p>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill value={lead.qualificationStatus} compact />
                  </td>
                  <td colSpan={8} className="px-3 py-2 text-[10px] text-[#8793a4] italic">
                    Skipped — not eligible for Preview Studio without manual QUALIFY override
                  </td>
                </tr>
              ))}

              {eligibleLeads.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-xs text-[#8793a4]">
                    No eligible leads for Preview Studio yet. Qualify leads first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawers and modals */}
      {drawerPreviewId && drawerLeadName && (
        <V0PromptDrawer
          leadName={drawerLeadName}
          previewId={drawerPreviewId}
          onClose={() => { setDrawerLeadName(null); setDrawerPreviewId(null); }}
          onGeneratePrompt={async () => {
            const lead = leads.find((l) => l.name === drawerLeadName);
            if (lead) await handleGeneratePrompt(lead);
          }}
        />
      )}
      {addUrlPreviewId && (
        <AddPreviewUrlModal
          previewId={addUrlPreviewId}
          onClose={() => setAddUrlPreviewId(null)}
          onSuccess={(url) => {
            // Find which lead has this previewId and update their state
            for (const [leadId, state] of Object.entries(rowStates)) {
              if (state.previewId === addUrlPreviewId) {
                updateState(leadId, { finalPreviewUrl: url, workflowStatus: "PREVIEW_LINK_ADDED" });
                break;
              }
            }
            setAddUrlPreviewId(null);
          }}
        />
      )}
    </div>
  );
}

export function LeadEngine() {
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [leads, setLeads] = useState<Lead[]>(sampleLeads);
  const [mode, setMode] = useState<WorkspaceMode>("DEMO");
  const [lastImportReport, setLastImportReport] = useState<ImportReport | null>(
    null,
  );
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [auditRunningIds, setAuditRunningIds] = useState<string[]>([]);
  const [qualitativeRunningIds, setQualitativeRunningIds] = useState<string[]>([]);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrateWorkspace() {
      try {
        const authResponse = await fetch("/api/auth");
        const auth = await authResponse.json() as { authenticated?: boolean };
        if (!authResponse.ok || !auth.authenticated) {
          if (!cancelled) setAuthRequired(true);
          return;
        }

        const response = await fetch("/api/workspace");
        const parsed = await response.json() as { error?: string; leads?: Lead[]; mode?: WorkspaceMode; lastImportReport?: ImportReport | null };
        if (!response.ok) throw new Error(parsed.error ?? "Workspace unavailable");
        if (Array.isArray(parsed.leads)) setLeads(parsed.leads);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.lastImportReport !== undefined) setLastImportReport(parsed.lastImportReport ?? null);
        if (!cancelled) {
          setAuthRequired(false);
          setWorkspaceError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Workspace unavailable");
        }
      } finally {
        if (!cancelled) setStorageHydrated(true);
      }
    }
    void hydrateWorkspace();
    return () => { cancelled = true; };
  }, []);

  async function signIn() {
    const token = window.prompt("Enter the Diginest admin token to load the production workspace.");
    if (!token) return;
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setAuthRequired(true);
      setWorkspaceError("Invalid admin token");
      return;
    }
    window.location.reload();
  }

  async function ensureAdminSession() {
    const session = await fetch("/api/auth");
    if (session.ok && (await session.json()).authenticated) return true;
    const token = window.prompt("Enter the Diginest admin token to perform this production action.");
    if (!token) return false;
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    setAuthRequired(!response.ok);
    return response.ok;
  }

  function updateLead(id: string, patch: Partial<Lead>) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.leadId !== id) return lead;
        const next = { ...lead, ...patch };
        if (patch.manualDecision !== undefined)
          next.qualificationStatus = effectiveQualificationFor(
            next.manualDecision,
            next.automaticQualification,
          );
        if (selectedLead?.leadId === id) setSelectedLead(next);
        if (mode === "PRODUCTION") {
          void fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", lead: next }) });
        }
        return next;
      }),
    );
  }
  async function importLeads(imported: Lead[], report: ImportReport, importMode: ImportMode) {
    if (!(await ensureAdminSession())) throw new Error("Authentication required");
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: importMode === "REPLACE" ? "replace" : "append", mode: importMode, leads: imported, report }) });
    const payload = (await response.json()) as { error?: string; leads?: Lead[]; mode?: WorkspaceMode; lastImportReport?: ImportReport | null };
    if (!response.ok || !payload.leads) throw new Error(payload.error ?? "Workspace import failed");
    setLeads(payload.leads);
    setMode(payload.mode ?? "PRODUCTION");
    setLastImportReport(payload.lastImportReport ?? null);
    setSelectedLead(null);
  }
  async function clearImportedLeads() {
    if (mode !== "PRODUCTION") return;
    if (
      !window.confirm(
        "Clear all imported leads from this workspace? This cannot be undone.",
      )
    )
      return;
    if (!(await ensureAdminSession())) return;
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) });
    if (!response.ok) return;
    setLeads([]);
    setLastImportReport(null);
    setSelectedLead(null);
  }
  async function resetToDemo() {
    if (
      !window.confirm(
        "Reset this workspace to development demo data? Imported leads will be removed.",
      )
    )
      return;
    if (mode === "PRODUCTION" && !(await ensureAdminSession())) return;
    if (mode === "PRODUCTION") {
      await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) });
    }
    setLeads(sampleLeads);
    setMode("DEMO");
    setLastImportReport(null);
    setSelectedLead(null);
  }

  function applyAuditToLead(id: string, audit: WebsiteAudit) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.leadId !== id) return lead;
        const score = calculateLeadScore({ ...lead, audit });
        const automaticQualification = automaticQualificationFor({
          hasWebsite: lead.hasWebsite,
          audit,
          score,
        });
        const next = {
          ...lead,
          audit,
          score,
          automaticQualification,
          qualificationStatus: effectiveQualificationFor(
            lead.manualDecision,
            automaticQualification,
          ),
        };
        setSelectedLead((currentSelected) =>
          currentSelected?.leadId === id ? next : currentSelected,
        );
        return next;
      }),
    );
  }

  async function auditLead(id: string) {
    const lead = leads.find((item) => item.leadId === id);
    if (!lead?.hasWebsite || !lead.website) return;
    if (!(await ensureAdminSession())) return;
    const retryCount = (lead.audit.retryCount ?? 0) + 1;
    try {
      const queued = transitionAuditStatus(lead.audit, "QUEUED");
      const auditing = transitionAuditStatus(
        { ...queued, retryCount, lastAttemptAt: new Date().toISOString() },
        "AUDITING",
      );
      applyAuditToLead(id, auditing);
      setAuditRunningIds((current) => [...new Set([...current, id])]);
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: id,
          requestedUrl: lead.website,
          retryCount,
        }),
      });
      const payload = (await response.json()) as {
        audit?: WebsiteAudit;
        error?: string;
      };
      if (!response.ok || !payload.audit)
        throw new Error(payload.error ?? "Audit request failed");
      applyAuditToLead(id, payload.audit);
    } catch (error) {
      applyAuditToLead(id, {
        ...lead.audit,
        status: "FAILED",
        objectiveAuditStatus: "FAILED",
        qualitativeAuditStatus: "NOT_READY",
        pageReachable: false,
        failureReason: "BROWSER_ERROR",
        failureMessage:
          error instanceof Error ? error.message : "Audit request failed",
        retryCount,
        lastAttemptAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    } finally {
      setAuditRunningIds((current) => current.filter((item) => item !== id));
    }
  }

  async function auditSelected(ids: string[]) {
    for (const id of ids) await auditLead(id);
  }

  async function auditNext(count: number) {
    const nextIds = leads
      .filter(
        (lead) =>
          lead.hasWebsite &&
          lead.website &&
          ["PENDING", "FAILED", "BLOCKED"].includes(lead.audit.objectiveAuditStatus ?? lead.audit.status),
      )
      .slice(0, count)
      .map((lead) => lead.leadId);
    await auditSelected(nextIds);
  }

  function applyQualitativeAnalysisResult(id: string, result: QualitativeResult) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.leadId !== id) return lead;
        const next = applyQualitativeResultToLead(lead, result, lead.audit.qualitativeRetryCount ?? 1);
        setSelectedLead((currentSelected) => currentSelected?.leadId === id ? next : currentSelected);
        return next;
      }),
    );
  }

  async function analyzeLead(id: string) {
    const lead = leads.find((item) => item.leadId === id);
    if (!lead?.hasWebsite || !lead.website || lead.audit.objectiveAuditStatus !== "COMPLETE") return;
    if (!(await ensureAdminSession())) return;
    const retryCount = (lead.audit.qualitativeRetryCount ?? 0) + 1;
    const idempotencyKey = qualitativeIdempotencyKey(lead, retryCount);
    try {
      const currentStatus = qualitativeStatusFor(lead.audit);
      const pending = currentStatus === "COMPLETE" ? transitionQualitativeStatus(lead.audit, "PENDING") : lead.audit;
      const startedAt = new Date().toISOString();
      const analyzing = transitionQualitativeStatus({
        ...pending,
        qualitativeRetryCount: retryCount,
        qualitativeStartedAt: startedAt,
        qualitativeHeartbeatAt: startedAt,
      }, "ANALYZING");
      setLeads((current) => current.map((item) => item.leadId === id ? { ...item, audit: analyzing } : item));
      setSelectedLead((current) => current?.leadId === id ? { ...current, audit: analyzing } : current);
      setQualitativeRunningIds((current) => [...new Set([...current, id])]);
      const response = await fetch("/api/qualitative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, retryCount, idempotencyKey }),
      });
      const payload = await response.json() as { result?: QualitativeResult; audit?: WebsiteAudit; error?: string };
      if (payload.result) applyQualitativeAnalysisResult(id, payload.result);
      else if (payload.audit) {
        setLeads((current) => current.map((item) => item.leadId === id ? { ...item, audit: payload.audit! } : item));
        setSelectedLead((current) => current?.leadId === id ? { ...current, audit: payload.audit! } : current);
      }
      if (!response.ok) throw new Error(payload.error ?? "Qualitative analysis failed");
    } catch (error) {
      const timestamp = new Date().toISOString();
      const failedLeadAudit = (item: Lead): WebsiteAudit => ({
        ...item.audit,
        qualitativeAuditStatus: "FAILED",
        qualitativeCompletedAt: timestamp,
        qualitativeHeartbeatAt: timestamp,
        qualitativeFailureReason: "PROVIDER_ERROR",
        qualitativeFailureMessage: error instanceof Error ? error.message : "Qualitative analysis failed",
      });
      setLeads((current) => current.map((item) => item.leadId === id ? {
        ...item,
        audit: failedLeadAudit(item),
      } : item));
      setSelectedLead((current) => current?.leadId === id ? { ...current, audit: failedLeadAudit(current) } : current);
    } finally {
      setQualitativeRunningIds((current) => current.filter((item) => item !== id));
    }
  }

  async function analyzeSelected(ids: string[]) {
    const limit = 4;
    const executing = new Set<Promise<void>>();
    for (const id of ids) {
      const p = analyzeLead(id).finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  async function analyzeNext(count: number) {
    const nextIds = leads.filter((lead) =>
      lead.hasWebsite && lead.website && lead.audit.objectiveAuditStatus === "COMPLETE" &&
      ["PENDING", "FAILED"].includes(qualitativeStatusFor(lead.audit)),
    ).slice(0, count).map((lead) => lead.leadId);
    await analyzeSelected(nextIds);
  }

  function selectView(view: ViewName) {
    setActiveView(view);
    setMobileNavOpen(false);
  }
  function navBadge(label: ViewName) {
    if (label === "Leads") return String(leads.length);
    if (label === "Website Audit")
      return String(
        leads.filter(
          (lead) => lead.hasWebsite && (lead.audit.objectiveAuditStatus ?? lead.audit.status) === "PENDING",
        ).length,
      );
    if (label === "Preview Studio")
      return String(
        leads.filter((lead) =>
          lead.qualificationStatus === "QUALIFIED" || lead.manualDecision === "QUALIFY"
        ).length,
      );
    return "";
  }
  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-[#0a1628] text-white transition-transform lg:static lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center gap-3 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d4ff] text-[#0a1628]">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-[-.02em]">Diginest</p>
            <p className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#7d93aa]">
              Lead Engine
            </p>
          </div>
        </div>
        <div className="mx-4 border-t border-white/10" />
        <nav className="flex-1 px-3 py-5">
          {navItems.map(({ label, icon: Icon }) => {
            const badge = navBadge(label);
            return (
              <button
                key={label}
                onClick={() => selectView(label)}
                className={cn(
                  "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition",
                  activeView === label
                    ? "bg-white/10 text-white shadow-[inset_2px_0_0_#00d4ff]"
                    : "text-[#90a2b7] hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={activeView === label ? 2.4 : 1.8}
                />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                      activeView === label
                        ? "bg-[#00d4ff]/15 text-[#00d4ff]"
                        : "bg-white/10 text-[#8195aa]",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.12)]" />
              <span className="text-[10px] font-semibold text-[#a7b8ca]">
                Workspace online
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em]",
                mode === "DEMO"
                  ? "bg-violet-400/15 text-violet-200"
                  : "bg-emerald-400/15 text-emerald-200",
              )}
            >
              {mode}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#70849a]">
            {mode === "DEMO"
              ? "Sample data loaded for development"
              : "Real imported leads only"}
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c3552] text-[11px] font-bold text-[#bfefff]">
            DA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-[#d8e3ee]">
              Diginest Admin
            </p>
            <p className="truncate text-[10px] text-[#73879d]">Workspace admin</p>
          </div>
          <MoreHorizontal size={15} className="text-[#7b8ea3]" />
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-[#07111f]/35 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5eaf0] bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#68788b] hover:bg-[#f5f7fa] lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-[#8a96a5] sm:flex">
              <span className="font-semibold text-[#27364b]">Workspace</span>
              <ChevronRight size={13} />
              <span>{activeView}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em]",
                  mode === "DEMO"
                    ? "bg-violet-50 text-violet-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {mode}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00d4ff] text-[#0a1628]">
                <Zap size={15} fill="currentColor" />
              </span>
              <span className="text-xs font-bold text-[#17243a]">
                Diginest Lead Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-8">
          {(authRequired || workspaceError) && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                {authRequired
                  ? "Sign in to load the production workspace."
                  : `Workspace unavailable: ${workspaceError}`}
              </span>
              {authRequired && (
                <button
                  onClick={() => void signIn()}
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
                >
                  Sign in
                </button>
              )}
            </div>
          )}
          {activeView === "Overview" && (
            <OverviewView
              leads={leads}
              onViewLeads={() => selectView("Leads")}
              onOpenLead={setSelectedLead}
            />
          )}
          {activeView === "Leads" && (
            <LeadsView
              leads={leads}
              onOpenLead={setSelectedLead}
              onImport={() => setShowImport(true)}
              onUpdateLead={updateLead}
              lastImportReport={lastImportReport}
            />
          )}
          {activeView === "Website Audit" && (
            <WebsiteAuditView
              leads={leads}
              onOpenLead={setSelectedLead}
              onAuditSelected={auditSelected}
              onAuditNext={auditNext}
              onAnalyzeSelected={analyzeSelected}
              onAnalyzeNext={analyzeNext}
              auditingIds={auditRunningIds}
              analyzingIds={qualitativeRunningIds}
            />
          )}
          {activeView === "Qualified" && (
            <QualifiedView leads={leads} onOpenLead={setSelectedLead} />
          )}
          {activeView === "Preview Studio" && (
            <PreviewStudioView leads={leads} onOpenLead={setSelectedLead} ensureAdminSession={ensureAdminSession} />
          )}
          {activeView === "Outreach" && (
            <OutreachStudioView leads={leads} />
          )}
          {activeView !== "Overview" &&
            activeView !== "Leads" &&
            activeView !== "Website Audit" &&
            activeView !== "Qualified" &&
            activeView !== "Preview Studio" &&
            activeView !== "Outreach" && (
              <EmptyView
                view={activeView}
                leads={leads}
                onImport={() => setShowImport(true)}
                mode={mode}
                onClearImported={clearImportedLeads}
                onResetDemo={resetToDemo}
              />
            )}
        </main>
      </div>
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={updateLead}
          onAnalyzeLead={analyzeLead}
          qualitativeRunning={qualitativeRunningIds.includes(selectedLead.leadId)}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={importLeads}
          existingLeadCount={leads.length}
        />
      )}
    </div>
  );
}

