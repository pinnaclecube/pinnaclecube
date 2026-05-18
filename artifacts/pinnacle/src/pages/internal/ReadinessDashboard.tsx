import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  RefreshCw,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReadinessScore {
  total: number;
  band: "getting_started" | "in_progress" | "building" | "nearly_ready" | "filing_ready";
  bandLabel: string;
  bandColor: string;
  components: {
    driveConnected: number;
    assessmentsComplete: number;
    evidenceStrength: number;
    rfeRiskPenalty: number;
    exhibitsGenerated: number;
    packageDocuments: number;
    publishedToClient: number;
  };
  details: {
    totalCriteria: number;
    assessedCriteria: number;
    strongCriteria: number;
    borderlineCriteria: number;
    insufficientCriteria: number;
    highRfeCriteria: number;
    proceedCriteria: number;
    generatedExhibits: number;
    publishedExhibits: number;
    coverLetterDone: boolean;
    personalDeclarationDone: boolean;
    fieldBriefDone: boolean;
    recoTemplatesDone: boolean;
    pendingTasks: number;
    completedTasks: number;
    driveConnected: boolean;
  };
  nextActions: string[];
}

interface CaseReadinessSummary {
  profileId: number;
  caseSetupId: number;
  clientName: string;
  clientEmail: string;
  visaPath: string;
  score: ReadinessScore;
  lastActivity: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function visaBadgeClass(visaPath: string): string {
  if (visaPath === "eb1a") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (visaPath === "niw") return "bg-violet-100 text-violet-800 border-violet-200";
  if (visaPath === "o1") return "bg-cyan-100 text-cyan-800 border-cyan-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function visaLabel(visaPath: string): string {
  if (visaPath === "eb1a") return "EB-1A";
  if (visaPath === "niw") return "EB-2 NIW";
  if (visaPath === "o1") return "O-1A";
  return visaPath.toUpperCase();
}

function tabForAction(action: string): string {
  const low = action.toLowerCase();
  if (low.includes("assessment") || low.includes("rfe")) return "petition-assessment";
  if (low.includes("exhibit") || low.includes("publish")) return "exhibits";
  if (low.includes("cover letter") || low.includes("declaration") || low.includes("field brief")) return "documents";
  return "overview";
}

// ─── SVG Score Arc ────────────────────────────────────────────────────────────
// Top semicircle gauge: left (180°) → over top → right (0°)
// Sweep=0 (CCW in SVG) traces the top half

function ScoreArc({ score, color }: { score: number; color: string }) {
  const cx = 100, cy = 100, r = 80, sw = 16;

  // Two 90° arcs for an unambiguous top semicircle track
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;

  // Fill arc: from left point, CCW upward to score-computed angle
  // endAngle in standard math = π - (score/100)*π
  const clamped = Math.max(0, Math.min(100, score));
  const endAngle = Math.PI - (clamped / 100) * Math.PI;
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle); // minus → top gauge

  let fillPath: string | null = null;
  if (clamped > 0 && clamped < 100) {
    const largeArc = 0; // All arcs score 0-99 are ≤180°, always small arc CCW upward
    fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 0 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
  } else if (clamped >= 100) {
    fillPath = trackPath;
  }

  // Needle: from center toward arc point, shorter than arc radius
  const needleLen = r * 0.65;
  const nx = cx + needleLen * Math.cos(endAngle);
  const ny = cy - needleLen * Math.sin(endAngle);

  return (
    <svg viewBox="0 0 200 128" className="w-full" aria-label={`Readiness score: ${score}`}>
      {/* Track */}
      <path d={trackPath} fill="none" stroke="#E2E8F0" strokeWidth={sw} strokeLinecap="round" />

      {/* Colored fill */}
      {fillPath && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}

      {/* Needle */}
      {clamped > 0 && (
        <>
          <line
            x1={cx} y1={cy}
            x2={nx.toFixed(2)} y2={ny.toFixed(2)}
            stroke="#1A1A2E"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={5} fill="#1A1A2E" />
          <circle cx={cx} cy={cy} r={2.5} fill="white" />
        </>
      )}
      {clamped === 0 && <circle cx={cx} cy={cy} r={5} fill="#CBD5E1" />}

      {/* Range labels */}
      <text x={cx - r + 2} y={cy + 18} fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily="sans-serif">0</text>
      <text x={cx + r - 2} y={cy + 18} fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily="sans-serif">100</text>

      {/* Score number */}
      <text
        x={cx} y={cy + 14}
        fontSize="32"
        fontWeight="700"
        fill="#1A1A2E"
        textAnchor="middle"
        fontFamily="sans-serif"
        dominantBaseline="middle"
      >
        {clamped}
      </text>
    </svg>
  );
}

// ─── Component Bar Row ────────────────────────────────────────────────────────

function ComponentBar({
  label,
  value,
  max,
  color,
  isNegative = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  isNegative?: boolean;
}) {
  const pct = isNegative
    ? Math.min(100, (Math.abs(value) / Math.abs(max)) * 100)
    : max > 0
    ? Math.min(100, (value / max) * 100)
    : 0;

  const displayValue = isNegative ? (value === 0 ? "0" : String(value)) : `${value}/${max}`;
  const barColor = isNegative && value < 0 ? "#EF4444" : color;

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span
        className="text-xs font-mono w-10 text-right shrink-0"
        style={{ color: isNegative && value < 0 ? "#EF4444" : "#64748B" }}
      >
        {displayValue}
      </span>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex gap-5">
          {/* Arc skeleton */}
          <div className="w-44 shrink-0">
            <div className="aspect-[200/128] bg-gray-100 rounded-xl animate-pulse" />
            <div className="mt-2 h-4 bg-gray-100 rounded animate-pulse w-24 mx-auto" />
          </div>
          {/* Info skeleton */}
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-100 rounded animate-pulse w-40" />
            <div className="h-3.5 bg-gray-100 rounded animate-pulse w-56" />
            <div className="space-y-2 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse w-32" />
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full animate-pulse" />
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-50 px-6 py-4 bg-gray-50/40">
        <div className="h-3.5 bg-gray-100 rounded animate-pulse w-48 mb-2" />
        <div className="flex gap-2">
          <div className="h-6 bg-gray-100 rounded-full animate-pulse w-40" />
          <div className="h-6 bg-gray-100 rounded-full animate-pulse w-32" />
        </div>
      </div>
    </div>
  );
}

// ─── Case Readiness Card ──────────────────────────────────────────────────────

function ReadinessCard({ c }: { c: CaseReadinessSummary }) {
  const [, navigate] = useLocation();
  const { score } = c;
  const basePath = `/internal/case/${c.profileId}`;

  const components: { label: string; value: number; max: number; isNegative?: boolean }[] = [
    { label: "Drive Connected", value: score.components.driveConnected, max: 10 },
    { label: "Assessments", value: score.components.assessmentsComplete, max: 20 },
    { label: "Evidence Strength", value: score.components.evidenceStrength, max: 15 },
    { label: "RFE Risk Penalty", value: score.components.rfeRiskPenalty, max: -10, isNegative: true },
    { label: "Exhibits Generated", value: score.components.exhibitsGenerated, max: 20 },
    { label: "Package Documents", value: score.components.packageDocuments, max: 15 },
    { label: "Published to Client", value: score.components.publishedToClient, max: 10 },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200">
      {/* ── Top band color strip ── */}
      <div className="h-1.5 w-full" style={{ backgroundColor: score.bandColor }} />

      <div className="p-6 flex gap-5 flex-1">
        {/* ── Left: Arc meter ── */}
        <div className="w-44 shrink-0 flex flex-col items-center">
          <ScoreArc score={score.total} color={score.bandColor} />
          <span
            className="text-xs font-semibold mt-0.5 tracking-wide"
            style={{ color: score.bandColor }}
          >
            {score.bandLabel}
          </span>
        </div>

        {/* ── Right: Info + bars ── */}
        <div className="flex-1 min-w-0">
          {/* Client header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-[#1A1A2E] text-base truncate">{c.clientName}</h3>
            <Badge
              variant="outline"
              className={cn("text-xs px-2 py-0.5 shrink-0 font-medium", visaBadgeClass(c.visaPath))}
            >
              {visaLabel(c.visaPath)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3 truncate">{c.clientEmail}</p>

          {/* Component breakdown */}
          <div className="space-y-0.5">
            {components.map((comp) => (
              <ComponentBar
                key={comp.label}
                label={comp.label}
                value={comp.value}
                max={comp.max}
                color={score.bandColor}
                isNegative={comp.isNegative}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Next Actions ── */}
      {score.nextActions.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wide">Next Steps</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {score.nextActions.map((action, i) => {
              const tab = tabForAction(action);
              const href = `${basePath}?tab=${tab}`;
              return (
                <button
                  key={i}
                  onClick={() => navigate(href)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-[#1E2D6B] hover:bg-[#1E2D6B] hover:text-white hover:border-[#1E2D6B] transition-all duration-150 shadow-sm"
                >
                  {action}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Card Footer ── */}
      <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Last activity {formatRelativeTime(c.lastActivity)}</span>
        </div>
        <Link href={basePath}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3 border-[#1E2D6B]/20 text-[#1E2D6B] hover:bg-[#1E2D6B] hover:text-white"
          >
            View Case <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Sort / Filter types ──────────────────────────────────────────────────────

type SortOption = "score_asc" | "score_desc" | "name_asc" | "visa";
type VisaFilter = "all" | "eb1a" | "niw" | "o1";
type BandFilter = "all" | "getting_started" | "in_progress" | "building" | "nearly_ready" | "filing_ready";

const BAND_LABELS: Record<string, string> = {
  getting_started: "Getting Started",
  in_progress: "In Progress",
  building: "Building",
  nearly_ready: "Nearly Ready",
  filing_ready: "Filing Ready",
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ReadinessDashboard() {
  const [data, setData] = useState<CaseReadinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const [sortBy, setSortBy] = useState<SortOption>("score_asc");
  const [filterVisa, setFilterVisa] = useState<VisaFilter>("all");
  const [filterBand, setFilterBand] = useState<BandFilter>("all");

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (data.length === 0) setLoading(true);

    try {
      const r = await staffFetch("/admin/readiness");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setLastRefreshed(new Date());
      setSecondsAgo(0);
      setError(null);
    } catch (err) {
      setError("Failed to load readiness data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data.length]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 5 minutes
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchData]);

  // Seconds-ago counter
  useEffect(() => {
    secondsRef.current = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => {
      if (secondsRef.current) clearInterval(secondsRef.current);
    };
  }, []);

  // ── Sort + Filter ──────────────────────────────────────────────────────────

  const displayed = (() => {
    let arr = [...data];

    if (filterVisa !== "all") arr = arr.filter((c) => c.visaPath === filterVisa);
    if (filterBand !== "all") arr = arr.filter((c) => c.score.band === filterBand);

    switch (sortBy) {
      case "score_asc":
        arr.sort((a, b) => a.score.total - b.score.total);
        break;
      case "score_desc":
        arr.sort((a, b) => b.score.total - a.score.total);
        break;
      case "name_asc":
        arr.sort((a, b) => a.clientName.localeCompare(b.clientName));
        break;
      case "visa":
        arr.sort((a, b) => a.visaPath.localeCompare(b.visaPath));
        break;
    }

    return arr;
  })();

  // ── Summary stats ──────────────────────────────────────────────────────────

  const totalCases = data.length;
  const filingReady = data.filter((c) => c.score.band === "filing_ready").length;
  const needsAttention = data.filter((c) => c.score.total < 40).length;
  const avgScore = totalCases > 0 ? Math.round(data.reduce((sum, c) => sum + c.score.total, 0) / totalCases) : 0;

  // ── Last refreshed label ───────────────────────────────────────────────────

  const lastRefreshedLabel = (() => {
    if (!lastRefreshed) return null;
    if (secondsAgo < 60) return "Just now";
    const mins = Math.floor(secondsAgo / 60);
    return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />

      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {/* ── Page Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E] tracking-tight">Petition Readiness</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track filing readiness across all active cases
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshedLabel && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Refreshed {lastRefreshedLabel}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* ── Summary Bar ── */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#1E2D6B]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Cases</span>
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{totalCases}</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filing Ready</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600">{filingReady}</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Need Attention</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{needsAttention}</span>
              <span className="text-xs text-muted-foreground ml-1">score &lt; 40</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Score</span>
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{avgScore}</span>
              <span className="text-xs text-muted-foreground ml-1">/ 100</span>
            </div>
          </div>
        )}

        {/* ── Sort / Filter Controls ── */}
        {!loading && data.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Sort by…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score_asc">Score: Low to High</SelectItem>
                <SelectItem value="score_desc">Score: High to Low</SelectItem>
                <SelectItem value="name_asc">Client Name</SelectItem>
                <SelectItem value="visa">Visa Category</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVisa} onValueChange={(v) => setFilterVisa(v as VisaFilter)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="All visas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visas</SelectItem>
                <SelectItem value="eb1a">EB-1A</SelectItem>
                <SelectItem value="niw">NIW</SelectItem>
                <SelectItem value="o1">O-1A</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterBand} onValueChange={(v) => setFilterBand(v as BandFilter)}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All bands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bands</SelectItem>
                {Object.entries(BAND_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterVisa !== "all" || filterBand !== "all") && (
              <button
                onClick={() => { setFilterVisa("all"); setFilterBand("all"); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear filters
              </button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {displayed.length} of {totalCases} cases
            </span>
          </div>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="font-medium text-foreground">{error}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => fetchData(true)}>
              Try Again
            </Button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg text-foreground mb-1">No active cases</p>
            <p className="text-sm text-muted-foreground">Convert a prospect to get started.</p>
            <Link href="/internal/prospects">
              <Button size="sm" variant="outline" className="mt-4">View Prospects</Button>
            </Link>
          </div>
        )}

        {/* ── Filtered empty ── */}
        {!loading && !error && data.length > 0 && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No cases match the current filters.</p>
            <button
              onClick={() => { setFilterVisa("all"); setFilterBand("all"); }}
              className="text-sm text-[#1E2D6B] font-medium mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── Case cards grid ── */}
        {!loading && !error && displayed.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {displayed.map((c) => (
              <ReadinessCard key={c.caseSetupId} c={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
