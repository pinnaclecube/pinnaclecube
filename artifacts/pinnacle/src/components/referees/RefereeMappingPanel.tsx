/**
 * RefereeMappingPanel.tsx — Pinnacle³
 *
 * Step 3 — "What can this referee attest to?" Maps a referee to the case's
 * projects and evidence files (+ shared worked-together context). Shared by the
 * client portal and the staff portal (each passes its own fetchFn). Input for
 * AI letter generation in Step 4.
 *
 * Loads: GET /referees/:id/mappings, GET /cases/:caseId/projects,
 *        GET /cases/:caseId/evidence-files
 * Saves: PUT /referees/:id/mappings (single full-replace).
 * Read-only when the referee is locked (consistent with Step 2).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Loader2, Check, HandHeart, FolderKanban, FileText, Download, RefreshCw,
  AlertCircle, Lock, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

interface ProjectOption { id: number; title: string; organization: string | null }
interface EvidenceFile {
  id: number; fileName: string; mimeType: string; driveUrl: string;
  criterion: string; isStaffOnly: boolean;
}
interface EvidenceGroup { criterion: string; label: string; files: EvidenceFile[] }

interface MappingData {
  sharedOrganization: string | null;
  sharedPeriod: string | null;
  projects: { projectId: number; attestationNotes: string | null }[];
  evidence: { evidenceFileId: number; displayLabel: string; attestationNotes: string | null }[];
}

type ProjSel = Record<number, { checked: boolean; notes: string }>;
type EvSel = Record<number, { checked: boolean; label: string; notes: string }>;

function snapshot(
  org: string, period: string, proj: ProjSel, ev: EvSel,
): string {
  const p = Object.entries(proj).filter(([, v]) => v.checked).map(([id, v]) => `${id}:${v.notes}`).sort();
  const e = Object.entries(ev).filter(([, v]) => v.checked).map(([id, v]) => `${id}:${v.label}:${v.notes}`).sort();
  return JSON.stringify({ org, period, p, e });
}

export function RefereeMappingPanel({
  refereeId, caseId, fetchFn, workedTogether, readOnly = false, staff = false, onSaved,
}: {
  refereeId: number;
  caseId: number;
  fetchFn: FetchFn;
  workedTogether: boolean;
  readOnly?: boolean;
  staff?: boolean;
  onSaved?: (counts: { projects: number; evidence: number }) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [groups, setGroups] = useState<EvidenceGroup[]>([]);
  const [sharedOrg, setSharedOrg] = useState("");
  const [sharedPeriod, setSharedPeriod] = useState("");
  const [projSel, setProjSel] = useState<ProjSel>({});
  const [evSel, setEvSel] = useState<EvSel>({});
  const [savedSnap, setSavedSnap] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const applyMapping = useCallback((mapping: MappingData, projList: ProjectOption[], grps: EvidenceGroup[]) => {
    setSharedOrg(mapping.sharedOrganization ?? "");
    setSharedPeriod(mapping.sharedPeriod ?? "");
    const pNotes = new Map(mapping.projects.map((p) => [p.projectId, p.attestationNotes ?? ""]));
    const ps: ProjSel = {};
    for (const p of projList) ps[p.id] = { checked: pNotes.has(p.id), notes: pNotes.get(p.id) ?? "" };
    setProjSel(ps);
    const eMap = new Map(mapping.evidence.map((e) => [e.evidenceFileId, e]));
    const es: EvSel = {};
    for (const g of grps) for (const f of g.files) {
      const m = eMap.get(f.id);
      es[f.id] = { checked: !!m, label: m?.displayLabel ?? "", notes: m?.attestationNotes ?? "" };
    }
    setEvSel(es);
    setSavedSnap(snapshot(mapping.sharedOrganization ?? "", mapping.sharedPeriod ?? "", ps, es));
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setSyncing(true); else setLoading(true);
    setError(null);
    try {
      const [mapRes, projRes, evRes] = await Promise.all([
        fetchFn(`/referees/${refereeId}/mappings`).then((r) => r.json()),
        fetchFn(`/cases/${caseId}/projects`).then((r) => r.json()),
        fetchFn(`/cases/${caseId}/evidence-files${refresh ? "?refresh=1" : ""}`).then((r) => r.json()),
      ]);
      const projList: ProjectOption[] = (projRes.projects ?? []).map((p: ProjectOption) => ({
        id: p.id, title: p.title, organization: p.organization,
      }));
      const grps: EvidenceGroup[] = evRes.groups ?? [];
      setProjects(projList);
      setGroups(grps);
      applyMapping(mapRes.mappings as MappingData, projList, grps);
    } catch {
      setError("Could not load this referee's mapping. Please try again.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [refereeId, caseId, fetchFn, applyMapping]);

  useEffect(() => { void load(false); }, [load]);

  const dirty = useMemo(
    () => snapshot(sharedOrg, sharedPeriod, projSel, evSel) !== savedSnap,
    [sharedOrg, sharedPeriod, projSel, evSel, savedSnap],
  );

  const missingLabels = useMemo(
    () => Object.values(evSel).some((v) => v.checked && !v.label.trim()),
    [evSel],
  );

  async function handleSave() {
    if (missingLabels) {
      setShowErrors(true);
      toast({ title: "Each selected evidence item needs a label", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sharedOrganization: sharedOrg.trim() || null,
        sharedPeriod: sharedPeriod.trim() || null,
        projects: Object.entries(projSel)
          .filter(([, v]) => v.checked)
          .map(([id, v]) => ({ projectId: Number(id), attestationNotes: v.notes.trim() || null })),
        evidence: Object.entries(evSel)
          .filter(([, v]) => v.checked)
          .map(([id, v]) => ({ evidenceFileId: Number(id), displayLabel: v.label.trim(), attestationNotes: v.notes.trim() || null })),
      };
      const r = await fetchFn(`/referees/${refereeId}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      const fresh = d.mappings as MappingData;
      applyMapping(fresh, projects, groups);
      setShowErrors(false);
      onSaved?.({ projects: fresh.projects.length, evidence: fresh.evidence.length });
      toast({ title: "Mapping saved" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(f: EvidenceFile) {
    setDownloadingId(f.id);
    try {
      const r = await fetchFn(`/evidence-files/${f.id}/download`);
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = f.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Download failed", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  const setProj = (id: number, patch: Partial<{ checked: boolean; notes: string }>) =>
    setProjSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const setEv = (id: number, patch: Partial<{ checked: boolean; label: string; notes: string }>) =>
    setEvSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  if (loading) {
    return (
      <div className="rounded-lg border mt-4 p-4 flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-[#1E2D6B]" />
      </div>
    );
  }

  const nonEmptyGroups = groups.filter((g) => g.files.length > 0);

  return (
    <div className="rounded-lg border mt-4">
      <div className="px-4 py-3 border-b bg-gray-50/60 flex items-center gap-2">
        <HandHeart className="w-4 h-4 text-[#1E2D6B]" />
        <h3 className="text-sm font-semibold">What can this referee attest to?</h3>
        {readOnly && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-600">
            <Lock className="w-3 h-3" /> Locked — unlock to edit
          </span>
        )}
      </div>

      {error ? (
        <div className="p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void load(false)}>Retry</Button>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Shared context */}
          {workedTogether && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shared context</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Organization where you worked together</Label>
                  <Input value={sharedOrg} onChange={(e) => setSharedOrg(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <Label className="text-xs">Time period</Label>
                  <Input value={sharedPeriod} onChange={(e) => setSharedPeriod(e.target.value)}
                    placeholder="e.g. 2019–2023" disabled={readOnly} />
                </div>
              </div>
            </section>
          )}

          {/* Projects */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5" /> Projects
            </h4>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No projects yet. Add them in the <a href="/projects" className="text-[#1E2D6B] underline">Projects</a> section first.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const s = projSel[p.id] ?? { checked: false, notes: "" };
                  return (
                    <div key={p.id} className="rounded-md border px-3 py-2">
                      <label className={cn("flex items-start gap-2", readOnly ? "cursor-default" : "cursor-pointer")}>
                        <Checkbox checked={s.checked} disabled={readOnly}
                          onCheckedChange={(c) => setProj(p.id, { checked: c === true })} className="mt-0.5" />
                        <span className="text-sm min-w-0">
                          <span className="font-medium">{p.title}</span>
                          {p.organization && <span className="text-muted-foreground"> · {p.organization}</span>}
                        </span>
                      </label>
                      {s.checked && (
                        <Textarea value={s.notes} readOnly={readOnly}
                          onChange={(e) => setProj(p.id, { notes: e.target.value })}
                          placeholder="What can this referee say about this project? (optional)"
                          className="mt-2 min-h-[56px] resize-none text-sm" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Evidence */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Evidence
              </h4>
              <button onClick={() => void load(true)} disabled={syncing}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#1E2D6B] hover:text-[#3D4FA8] disabled:opacity-50"
                title="Re-sync evidence files from Drive">
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> Refresh from Drive
              </button>
            </div>
            {nonEmptyGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No evidence files yet. Upload documents to the case's Evidence folders in Drive, then Refresh.
              </p>
            ) : (
              <Accordion type="multiple" className="rounded-md border divide-y">
                {nonEmptyGroups.map((g) => {
                  const selectedCount = g.files.filter((f) => evSel[f.id]?.checked).length;
                  return (
                    <AccordionItem key={g.criterion} value={g.criterion} className="border-b-0 px-3">
                      <AccordionTrigger className="hover:no-underline text-sm">
                        <span className="font-medium">{g.label}</span>
                        <span className="ml-auto mr-2 text-[11px] text-muted-foreground">
                          {selectedCount > 0 ? `${selectedCount} selected · ` : ""}{g.files.length} file{g.files.length !== 1 ? "s" : ""}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        {g.files.map((f) => {
                          const s = evSel[f.id] ?? { checked: false, label: "", notes: "" };
                          const labelError = showErrors && s.checked && !s.label.trim();
                          return (
                            <div key={f.id} className="rounded-md border px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Checkbox checked={s.checked} disabled={readOnly}
                                  onCheckedChange={(c) => setEv(f.id, { checked: c === true })} />
                                <span className="text-sm min-w-0 flex-1 truncate">{f.fileName}</span>
                                {staff && f.isStaffOnly && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 shrink-0">
                                    <Shield className="w-2.5 h-2.5" /> staff-only
                                  </span>
                                )}
                                <button onClick={() => void handleDownload(f)} disabled={downloadingId === f.id}
                                  className="p-1 text-gray-400 hover:text-[#1E2D6B] shrink-0" title="Download">
                                  {downloadingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              {s.checked && (
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <Input value={s.label} readOnly={readOnly}
                                      onChange={(e) => setEv(f.id, { label: e.target.value })}
                                      placeholder='Label this item, e.g. "IEEE paper on claims automation, 2023"'
                                      className={cn("text-sm", labelError && "border-red-400")} />
                                    {labelError && (
                                      <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> A label is required
                                      </p>
                                    )}
                                  </div>
                                  <Textarea value={s.notes} readOnly={readOnly}
                                    onChange={(e) => setEv(f.id, { notes: e.target.value })}
                                    placeholder="What can this referee say about it? (optional)"
                                    className="min-h-[52px] resize-none text-sm" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </section>

          {/* Save */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-3 pt-1">
              {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
              <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
                disabled={!dirty || saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save mapping
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
