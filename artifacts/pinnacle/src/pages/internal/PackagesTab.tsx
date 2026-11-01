/**
 * PackagesTab.tsx — Pinnacle³ — Evidence Package module (staff), spec phase 8.
 *
 * EB-1A only. Generate modal (criteria defaults = criteria with confirmed groups,
 * confirm-groups-first toggle), a progress card that polls every 5s (per-stage
 * status + "Review groups" when paused), and a per-version review screen
 * (documents in exhibit order with thumbnail, flags, source files, and the
 * approve / regenerate / replace / package-level actions wired in phase 9).
 * Existing design-system components only.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Package, Sparkles, FileText, AlertTriangle, CheckCircle2, Download,
  RefreshCw, Users, Upload, XCircle, Send,
} from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { criterionLabel } from "@/lib/criterion";
import { cn } from "@/lib/utils";

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { "X-Staff-Token": getStaffToken() ?? "", ...(opts.headers ?? {}) },
  });
}

interface PackageRow { currentVersion: number; packageStatus: string; mergedPdfDriveUrl: string | null; clientNotifiedAt: string | null }
interface JobRow { id: number; status: string; stage: string | null; stageStatus: Record<string, { status?: string; metrics?: unknown }> | null; error: string | null; packageVersion: number }
interface DocFlag { kind: string; message: string; severity: string }
interface DocRow {
  id: number; role: string | null; exhibitCode: string | null; exhibitLabel: string | null; fileName: string;
  criteriaCode: string | null; flags: DocFlag[] | null; thumbnailDriveUrl: string | null; wordDriveUrl: string | null;
  sourceFileIds: number[] | null; renderStatus: string | null; approvedAt: string | null; publishedToClient: boolean | null;
}
interface PackagesState { package: PackageRow | null; job: JobRow | null; documents: DocRow[]; criteriaWithGroups: string[] }

const ACTIVE = ["queued", "processing", "awaiting_group_review"];
const STAGES = ["scan", "extract", "classify", "group", "plan", "generate", "assemble"];

export function PackagesTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [caseId, setCaseId] = useState<number | null>(null);
  const [visaPath, setVisaPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PackagesState | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [selCriteria, setSelCriteria] = useState<Set<string>>(new Set());
  const [confirmFirst, setConfirmFirst] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [regenFor, setRegenFor] = useState<number | null>(null);
  const [regenText, setRegenText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCase = useCallback(async () => {
    const r = await staffFetch(`/internal/petition/setup/${userId}`);
    const d = await r.json().catch(() => ({}));
    const id = d?.setup?.id ?? null;
    setCaseId(id);
    setVisaPath(d?.setup?.visaPath ?? null);
    return id as number | null;
  }, [userId]);

  const loadState = useCallback(async (cid: number) => {
    const r = await staffFetch(`/internal/cases/${cid}/packages`);
    if (!r.ok) return;
    setState((await r.json()) as PackagesState);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const id = await loadCase();
      if (id) await loadState(id);
      setLoading(false);
    })();
  }, [loadCase, loadState]);

  // Poll every 5s while a job is active.
  const jobActive = !!state?.job && ACTIVE.includes(state.job.status);
  useEffect(() => {
    if (!caseId || !jobActive) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(() => void loadState(caseId), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [caseId, jobActive, loadState]);

  // Default-select criteria that have confirmed groups whenever the modal opens.
  function openGenerate() {
    setSelCriteria(new Set(state?.criteriaWithGroups ?? []));
    setConfirmFirst(false);
    setGenOpen(true);
  }

  async function generate() {
    if (caseId == null) return;
    setGenerating(true);
    try {
      const r = await staffFetch(`/internal/cases/${caseId}/packages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteriaCodes: [...selCriteria], confirmGroupsFirst: confirmFirst }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: d.error ?? "Could not start", variant: "destructive" }); return; }
      toast({ title: d.alreadyRunning ? "A package job is already running" : `Package v${d.version} queued` });
      setGenOpen(false);
      await loadState(caseId);
    } finally { setGenerating(false); }
  }

  async function act(path: string, opts: RequestInit, okMsg?: string) {
    setBusy(path);
    try {
      const r = await staffFetch(path, opts);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: d.error ?? "Action failed", variant: "destructive" }); return false; }
      if (okMsg) toast({ title: okMsg });
      if (caseId) await loadState(caseId);
      return true;
    } finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" /></div>;
  if (visaPath && visaPath !== "eb1a") {
    return <div className="text-sm text-muted-foreground py-12 text-center">Evidence packages are available for EB-1A cases only.</div>;
  }

  const job = state?.job ?? null;
  const pkg = state?.package ?? null;
  const docs = state?.documents ?? [];
  const paused = job?.status === "awaiting_group_review";
  const ready = pkg?.packageStatus === "ready_for_review" || pkg?.packageStatus === "partially_approved" || pkg?.packageStatus === "approved";
  const flaggedCount = (d: DocRow) => (d.flags ?? []).length;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-[#1E2D6B]" /> Evidence Package</h3>
        <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" onClick={openGenerate} disabled={jobActive}>
          <Sparkles className="w-4 h-4" /> Generate package
        </Button>
      </div>

      {/* Progress card */}
      {jobActive && job && (
        <Card className="p-4 border-[#1E2D6B]/30">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-[#1E2D6B]" />
            <span className="text-sm font-medium">
              {paused ? "Paused — groups awaiting review" : `Generating package v${job.packageVersion}…`}
            </span>
            <Badge variant="outline" className="ml-auto">{job.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => {
              const st = job.stageStatus?.[s]?.status ?? (job.stage === s ? "running" : "pending");
              return (
                <span key={s} className={cn("text-[11px] px-2 py-0.5 rounded-full border",
                  st === "done" ? "bg-green-50 border-green-200 text-green-700"
                  : st === "running" ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-400")}>
                  {s}{st === "done" ? " ✓" : st === "running" ? " …" : ""}
                </span>
              );
            })}
          </div>
          {paused && (
            <Button size="sm" variant="outline" className="mt-3 gap-1.5"
              onClick={() => setLocation(`/internal/case/${userId}?tab=evidence-groups`)}>
              <Users className="w-4 h-4" /> Review groups
            </Button>
          )}
          {job.error && <p className="text-[11px] text-red-600 mt-2">{job.error}</p>}
        </Card>
      )}

      {job?.status === "failed" && (
        <Card className="p-3 border-red-200 bg-red-50/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">Package generation failed. {job.error}</span>
          <Button size="sm" variant="outline" className="ml-auto" disabled={busy !== null}
            onClick={() => void act(`/internal/packages/${job.id}/retry`, { method: "POST" }, "Re-queued")}>Retry</Button>
        </Card>
      )}

      {/* Review screen */}
      {ready && docs.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-[#1E2D6B]">Version {pkg?.currentVersion}</Badge>
            <span className="text-xs text-muted-foreground">{docs.length} documents · {pkg?.packageStatus.replace(/_/g, " ")}</span>
            <div className="ml-auto flex items-center gap-2">
              {pkg?.mergedPdfDriveUrl && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(pkg.mergedPdfDriveUrl!, "_blank")}>
                  <Download className="w-4 h-4" /> Merged PDF
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null}
                onClick={() => void act(`/internal/cases/${caseId}/packages/approve-unflagged`, { method: "POST" }, "Approved all unflagged")}>
                <CheckCircle2 className="w-4 h-4" /> Approve all unflagged
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null}
                onClick={() => void act(`/internal/cases/${caseId}/packages/notify-client`, { method: "POST" }, "Client notified")}>
                <Send className="w-4 h-4" /> Notify client now
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600" disabled={busy !== null}
                onClick={() => void act(`/internal/cases/${caseId}/packages/reject`, { method: "POST" }, "Package rejected")}>
                <XCircle className="w-4 h-4" /> Reject package
              </Button>
            </div>
          </div>

          {docs.map((d) => (
            <Card key={d.id} className={cn("p-3", flaggedCount(d) > 0 && "border-amber-300")}>
              <div className="flex gap-3">
                <div className="w-20 h-28 shrink-0 bg-gray-50 border rounded overflow-hidden flex items-center justify-center">
                  {d.thumbnailDriveUrl
                    ? <img src={d.thumbnailDriveUrl} alt="" className="w-full h-full object-cover" />
                    : <FileText className="w-6 h-6 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{d.exhibitCode}</span>
                    <span className="text-sm text-muted-foreground truncate">{d.exhibitLabel ?? d.fileName}</span>
                    <Badge variant="outline" className="text-[10px]">{d.role}</Badge>
                    {d.criteriaCode && <span className="text-[11px] text-muted-foreground">{criterionLabel(d.criteriaCode)}</span>}
                    {d.approvedAt && <Badge className="bg-green-600 text-[10px]">approved</Badge>}
                  </div>
                  {(d.flags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(d.flags ?? []).map((f, i) => (
                        <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
                          f.severity === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700")}>
                          <AlertTriangle className="w-2.5 h-2.5" /> {f.kind}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">{(d.sourceFileIds ?? []).length} source file(s)</p>

                  {regenFor === d.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input value={regenText} onChange={(e) => setRegenText(e.target.value)} placeholder="Regeneration instruction…" className="h-8 text-sm" />
                      <Button size="sm" disabled={busy !== null} onClick={async () => {
                        if (await act(`/internal/exhibit-documents/${d.id}/regenerate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: regenText }) }, "Regeneration queued")) { setRegenFor(null); setRegenText(""); }
                      }}>Submit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRegenFor(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-green-700" disabled={busy !== null || !!d.approvedAt}
                        onClick={() => void act(`/internal/exhibit-documents/${d.id}/approve`, { method: "POST" }, "Approved")}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { setRegenFor(d.id); setRegenText(""); }}>
                        <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" disabled={busy !== null}
                        onClick={() => document.getElementById(`replace-${d.id}`)?.click()}>
                        <Upload className="w-3.5 h-3.5" /> Replace
                      </Button>
                      <input id={`replace-${d.id}`} type="file" accept=".docx" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const fd = new FormData(); fd.append("file", file);
                        await act(`/internal/exhibit-documents/${d.id}/replace`, { method: "POST", body: fd }, "Replaced");
                      }} />
                      {d.wordDriveUrl && <a href={d.wordDriveUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#1E2D6B] underline ml-1">open .docx</a>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : !jobActive && job?.status !== "failed" ? (
        <div className="text-center py-16 border rounded-lg bg-white">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No evidence package yet.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openGenerate}><Sparkles className="w-4 h-4" /> Generate package</Button>
        </div>
      ) : null}

      {/* Generate modal */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generate evidence package</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Criteria</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {(state?.criteriaWithGroups ?? []).length === 0
                  ? <p className="text-xs text-muted-foreground">No criteria have confirmed evidence groups yet.</p>
                  : (state?.criteriaWithGroups ?? []).map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selCriteria.has(c)} onCheckedChange={(v) => {
                        setSelCriteria((prev) => { const n = new Set(prev); v ? n.add(c) : n.delete(c); return n; });
                      }} />
                      <span className="text-sm">{criterionLabel(c)}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">has groups</Badge>
                    </label>
                  ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Confirm groups first<br /><span className="text-[11px] text-muted-foreground">Pause after grouping for staff review before generating</span></span>
              <Switch checked={confirmFirst} onCheckedChange={setConfirmFirst} />
            </label>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3" /> Generation runs as a background job — you can leave this page; progress shows here.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]" disabled={generating || selCriteria.size === 0} onClick={() => void generate()}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
