/**
 * PetitionAssessmentTab.tsx — Pinnacle³
 *
 * Staff-only Criteria Assessment Dashboard embedded in InternalCaseDetail.
 * Shows one card per criterion with AI assessment results, override controls,
 * and exhibit generation triggers. Polls /exhibits/status while jobs are live.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { AIBadge } from "@/components/disclaimers/AIBadge";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  Loader2, ChevronDown, ChevronUp, RefreshCw,
  ShieldAlert, FileText, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── staffFetch (local copy to avoid cross-file dep) ─────────────────────────

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

// ─── Static CFR lookup ────────────────────────────────────────────────────────

const CFR_BY_NAME: Record<string, string> = {
  // EB-1A
  "Awards": "8 CFR § 204.5(h)(3)(i)",
  "Memberships": "8 CFR § 204.5(h)(3)(ii)",
  "Press": "8 CFR § 204.5(h)(3)(iii)",
  "Judging": "8 CFR § 204.5(h)(3)(iv)",
  "Original Contributions": "8 CFR § 204.5(h)(3)(v)",
  "Scholarly Articles": "8 CFR § 204.5(h)(3)(vi)",
  "Artistic Exhibitions": "8 CFR § 204.5(h)(3)(vii)",
  "Critical Role": "8 CFR § 204.5(h)(3)(viii)",
  "High Salary": "8 CFR § 204.5(h)(3)(ix)",
  "Commercial Success": "8 CFR § 204.5(h)(3)(x)",
  // NIW (Dhanasar)
  "Substantial Merit and National Importance": "26 I&N Dec. 884 — Prong 1",
  "Well Positioned to Advance": "26 I&N Dec. 884 — Prong 2",
  "Balance of National Interest": "26 I&N Dec. 884 — Prong 3",
  // O-1A
  "Major Awards": "8 CFR § 214.2(o)(3)(iii)(A)",
  "Press Coverage": "8 CFR § 214.2(o)(3)(iii)(C)",
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

function recoCls(r: string | null) {
  if (r === "STRONG") return "bg-green-100 text-green-800 border-green-200";
  if (r === "BORDERLINE") return "bg-amber-100 text-amber-800 border-amber-200";
  if (r === "INSUFFICIENT") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function riskCls(r: string | null) {
  if (r === "LOW") return "bg-green-50 text-green-700 border-green-200";
  if (r === "MEDIUM") return "bg-amber-50 text-amber-700 border-amber-200";
  if (r === "HIGH") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-500 border-gray-200";
}

function decisionCls(d: string | null) {
  if (d === "proceed") return "bg-green-600 text-white";
  if (d === "skip") return "bg-gray-400 text-white";
  return "bg-amber-100 text-amber-700";
}

function decisionLabel(d: string | null) {
  if (d === "proceed") return "PROCEED";
  if (d === "skip") return "SKIP";
  return "AWAITING";
}

// ─── BulletSection ────────────────────────────────────────────────────────────

function BulletSection({ title, items, accent }: { title: string; items: string[]; accent?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", accent ?? "text-muted-foreground")}>{title}</p>
      <ul className="space-y-0.5">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
            <span className="mt-1 shrink-0 w-1 h-1 rounded-full bg-current opacity-50" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── CriteriaCard ─────────────────────────────────────────────────────────────

interface CriteriaCardProps {
  exhibit: any;
  assessment: any;
  runningAssessment: boolean;
  generatingExhibit: boolean;
  onRunAssessment: () => void;
  onOpenOverride: () => void;
  onGenerateExhibit: () => void;
}

function CriteriaCard({
  exhibit, assessment, runningAssessment, generatingExhibit,
  onRunAssessment, onOpenOverride, onGenerateExhibit,
}: CriteriaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfr = CFR_BY_NAME[exhibit.criteriaName] ?? exhibit.criteriaCode;
  const assessed = !!assessment?.assessedAt;

  return (
    <Card className={cn(
      "border transition-shadow",
      runningAssessment && "border-blue-200 shadow-md",
    )}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[#1E2D6B]">{exhibit.criteriaName}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", recoCls(assessment?.recommendation ?? null))}>
                {assessment?.recommendation ?? "PENDING"}
              </span>
              {assessment?.rfeRisk && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", riskCls(assessment.rfeRisk))}>
                  RFE {assessment.rfeRisk}
                </span>
              )}
              <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold", decisionCls(assessment?.finalDecision ?? null))}>
                {decisionLabel(assessment?.finalDecision ?? null)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{cfr}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              onClick={onRunAssessment}
              disabled={runningAssessment}
            >
              {runningAssessment
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running…</>
                : <><RefreshCw className="w-3 h-3 mr-1" />{assessed ? "Re-assess" : "Assess"}</>
              }
            </Button>
            {assessed && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={onOpenOverride}
              >
                <ShieldAlert className="w-3 h-3 mr-1" />Override
              </Button>
            )}
            <Button
              size="sm"
              className={cn(
                "h-7 text-xs",
                assessment?.finalDecision === "proceed"
                  ? "bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white"
                  : "opacity-50 cursor-not-allowed bg-gray-200 text-gray-500",
              )}
              onClick={onGenerateExhibit}
              disabled={assessment?.finalDecision !== "proceed" || generatingExhibit}
            >
              {generatingExhibit
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating…</>
                : <><FileText className="w-3 h-3 mr-1" />Generate Exhibits</>
              }
            </Button>
          </div>
        </div>

        {/* Confidence bar */}
        {assessed && assessment?.confidenceScore != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-xs font-semibold">{assessment.confidenceScore}%</p>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  assessment.confidenceScore >= 70 ? "bg-green-500" :
                  assessment.confidenceScore >= 40 ? "bg-amber-400" : "bg-red-400",
                )}
                style={{ width: `${assessment.confidenceScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {assessment?.summary && (
          <div className="space-y-1.5">
            <AIOutputBanner variant="summary" className="mb-0 py-2" />
            <div className="flex items-start gap-1.5 text-xs text-foreground/80 px-1">
              <AIBadge />
              <span>{assessment.summary}</span>
            </div>
          </div>
        )}

        {/* Staff override indicator */}
        {assessment?.staffOverride && (
          <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-md p-2.5 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-700">Staff Override</span>
              {assessment.staffOverrideBy && <span className="text-purple-600"> by {assessment.staffOverrideBy}</span>}
              {assessment.staffOverrideNote && <p className="text-purple-600 mt-0.5">"{assessment.staffOverrideNote}"</p>}
            </div>
          </div>
        )}

        {/* Documents analyzed */}
        {assessed && assessment?.documentsAnalyzed != null && (
          <p className="text-xs text-muted-foreground">{assessment.documentsAnalyzed} document{assessment.documentsAnalyzed !== 1 ? "s" : ""} analyzed</p>
        )}

        {/* Accordion */}
        {assessed && (
          <>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded((p) => !p)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide details" : "Show details"}
            </button>

            {expanded && (
              <div className="border-t pt-3 space-y-3">
                <BulletSection title="Strengths" items={assessment.strengths ?? []} accent="text-green-700" />
                <BulletSection title="Weaknesses" items={assessment.weaknesses ?? []} accent="text-amber-700" />
                <BulletSection title="Missing Evidence" items={assessment.missingEvidence ?? []} accent="text-orange-700" />
                <BulletSection title="Adjudicator Concerns" items={assessment.adjudicatorConcerns ?? []} accent="text-red-700" />
              </div>
            )}
          </>
        )}

        {/* Running spinner (no assessment yet) */}
        {runningAssessment && !assessed && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Assessment in progress…
          </div>
        )}

        {/* Exhibit generation progress */}
        {generatingExhibit && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating exhibits in background — this may take a few minutes…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PetitionAssessmentTab ────────────────────────────────────────────────────

export function PetitionAssessmentTab({ userId }: { userId: string }) {
  const [caseSetupId, setCaseSetupId] = useState<number | null>(null);
  const [setup, setSetup] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [assessmentMap, setAssessmentMap] = useState<Record<string, any>>({});
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noCase, setNoCase] = useState(false);

  const [runningAll, setRunningAll] = useState(false);
  const [runningAssessment, setRunningAssessment] = useState<Record<string, boolean>>({});
  const [generatingExhibit, setGeneratingExhibit] = useState<Record<string, boolean>>({});

  const [overrideModal, setOverrideModal] = useState<{ code: string; name: string } | null>(null);
  const [overrideDecision, setOverrideDecision] = useState<"proceed" | "skip">("proceed");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCountRef = useRef(0);

  // ── Load status ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async (csId: number) => {
    try {
      const r = await staffFetch(`/cases/${csId}/exhibits/status`);
      if (!r.ok) return;
      const d = await r.json();
      const map: Record<string, any> = {};
      for (const a of d.assessments ?? []) map[a.criteriaCode] = a;
      setAssessmentMap(map);
      setReadiness(d.readiness);
      return Object.keys(map).length;
    } catch { return 0; }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await staffFetch(`/internal/petition/setup/${userId}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const first = d.cases?.[0];
        if (!first?.setup) { setNoCase(true); return; }
        const sid = first.setup.id;
        setCaseSetupId(sid);
        setSetup(first.setup);
        setCriteria(first.exhibits ?? []);
        prevCountRef.current = 0;
        await loadStatus(sid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, loadStatus]);

  // ── Polling ────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((csId: number) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const count = await loadStatus(csId);
      if (count !== undefined && count !== prevCountRef.current) {
        prevCountRef.current = count;
      }
    }, 5000);
  }, [loadStatus]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Stop polling when all assessments have landed and nothing is generating
  useEffect(() => {
    const anyRunning = runningAll || Object.values(generatingExhibit).some(Boolean);
    if (!anyRunning && pollRef.current) stopPolling();
  }, [runningAll, generatingExhibit, stopPolling]);

  // ── Run all assessments ────────────────────────────────────────────────────

  const runAll = async () => {
    if (!caseSetupId) return;
    setRunningAll(true);
    try {
      await staffFetch(`/cases/${caseSetupId}/assess/all`, { method: "POST" });
      startPolling(caseSetupId);
      // Poll until all criteria have assessments
      const checkDone = setInterval(async () => {
        const count = await loadStatus(caseSetupId);
        if (count !== undefined && count >= criteria.length) {
          clearInterval(checkDone);
          setRunningAll(false);
          stopPolling();
        }
      }, 5000);
    } catch {
      setRunningAll(false);
    }
  };

  // ── Run single assessment ──────────────────────────────────────────────────

  const runSingle = async (criteriaCode: string) => {
    if (!caseSetupId) return;
    setRunningAssessment((p) => ({ ...p, [criteriaCode]: true }));
    try {
      const r = await staffFetch(`/cases/${caseSetupId}/assess/criteria/${criteriaCode}`, { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        if (d.assessment) {
          setAssessmentMap((p) => ({ ...p, [criteriaCode]: d.assessment }));
        }
      }
    } finally {
      setRunningAssessment((p) => ({ ...p, [criteriaCode]: false }));
    }
  };

  // ── Override ───────────────────────────────────────────────────────────────

  const submitOverride = async () => {
    if (!caseSetupId || !overrideModal || !overrideNote.trim()) return;
    setOverrideSaving(true);
    try {
      const r = await staffFetch(
        `/cases/${caseSetupId}/assess/criteria/${overrideModal.code}/override`,
        { method: "PATCH", body: JSON.stringify({ decision: overrideDecision, note: overrideNote }) },
      );
      if (r.ok) {
        const d = await r.json();
        if (d.assessment) {
          setAssessmentMap((p) => ({ ...p, [overrideModal.code]: d.assessment }));
        }
      }
      setOverrideModal(null);
      setOverrideNote("");
      setOverrideDecision("proceed");
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Generate exhibits ──────────────────────────────────────────────────────

  const generateExhibit = async (criteriaCode: string) => {
    if (!caseSetupId) return;
    setGeneratingExhibit((p) => ({ ...p, [criteriaCode]: true }));
    try {
      await staffFetch(`/cases/${caseSetupId}/exhibits/generate/criteria/${criteriaCode}`, { method: "POST" });
      startPolling(caseSetupId);
      // Auto-clear generating state after 3 minutes (max expected duration)
      setTimeout(() => setGeneratingExhibit((p) => ({ ...p, [criteriaCode]: false })), 180_000);
    } catch {
      setGeneratingExhibit((p) => ({ ...p, [criteriaCode]: false }));
    }
  };

  // ── Summary counts ────────────────────────────────────────────────────────

  const recoCount = (r: string) => criteria.filter((c) => assessmentMap[c.criteriaCode]?.recommendation === r).length;
  const pendingCount = criteria.filter((c) => !assessmentMap[c.criteriaCode]?.assessedAt).length;

  const visaLabel = setup?.visaPath?.toUpperCase().replace("NIW", "EB-2 NIW").replace("EB1A", "EB-1A").replace("O1", "O-1A") ?? "—";

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-gray-200 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (noCase || !caseSetupId) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-muted-foreground text-sm">No petition setup found. Create one in the Petition Workspace tab first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-[#1E2D6B]">Petition Assessment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visaLabel} · Case #{caseSetupId} · {criteria.length} criteria
          </p>
        </div>
        <Button
          onClick={runAll}
          disabled={runningAll || criteria.length === 0}
          className="bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white h-8 text-xs"
        >
          {runningAll
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running All…</>
            : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Run All Assessments</>
          }
        </Button>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ["STRONG", recoCount("STRONG"), "bg-green-50 border-green-200 text-green-700"],
          ["BORDERLINE", recoCount("BORDERLINE"), "bg-amber-50 border-amber-200 text-amber-700"],
          ["INSUFFICIENT", recoCount("INSUFFICIENT"), "bg-red-50 border-red-200 text-red-700"],
          ["PENDING", pendingCount, "bg-gray-50 border-gray-200 text-gray-500"],
        ] as [string, number, string][]).map(([label, count, cls]) => (
          <div key={label} className={cn("rounded-lg border px-4 py-3 text-center", cls)}>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs font-semibold tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Readiness bar ──────────────────────────────────────────────────── */}
      {readiness && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground">Petition Readiness</p>
            <p className="text-xs font-bold text-[#1E2D6B]">{readiness.percentage}%</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1E2D6B] rounded-full transition-all duration-700"
              style={{ width: `${readiness.percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {readiness.completedItems} of {readiness.expectedItems} expected items complete
          </p>
        </div>
      )}

      {/* ── All-running overlay indicator ──────────────────────────────────── */}
      {runningAll && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Running assessments for all {criteria.length} criteria — cards will update as results arrive…
        </div>
      )}

      {/* ── Criteria cards ─────────────────────────────────────────────────── */}
      {criteria.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">No criteria configured for this case.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {criteria.map((ex) => (
            <CriteriaCard
              key={ex.criteriaCode}
              exhibit={ex}
              assessment={assessmentMap[ex.criteriaCode] ?? null}
              runningAssessment={!!runningAssessment[ex.criteriaCode]}
              generatingExhibit={!!generatingExhibit[ex.criteriaCode]}
              onRunAssessment={() => runSingle(ex.criteriaCode)}
              onOpenOverride={() => {
                setOverrideModal({ code: ex.criteriaCode, name: ex.criteriaName });
                setOverrideDecision(assessmentMap[ex.criteriaCode]?.finalDecision === "skip" ? "skip" : "proceed");
                setOverrideNote("");
              }}
              onGenerateExhibit={() => generateExhibit(ex.criteriaCode)}
            />
          ))}
        </div>
      )}

      {/* ── Override modal ─────────────────────────────────────────────────── */}
      <Dialog open={!!overrideModal} onOpenChange={(open) => { if (!open) setOverrideModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff Override — {overrideModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              {(["proceed", "skip"] as const).map((opt) => (
                <label
                  key={opt}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors select-none",
                    overrideDecision === opt
                      ? opt === "proceed" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-400 bg-gray-100 text-gray-700"
                      : "border-gray-200 text-muted-foreground hover:border-gray-300",
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={overrideDecision === opt}
                    onChange={() => setOverrideDecision(opt)}
                  />
                  {opt === "proceed" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Override Note <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Reason for override — this will be recorded and displayed on the assessment card…"
                className="min-h-[90px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button
              onClick={submitOverride}
              disabled={overrideSaving || !overrideNote.trim()}
              className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
            >
              {overrideSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Apply Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
