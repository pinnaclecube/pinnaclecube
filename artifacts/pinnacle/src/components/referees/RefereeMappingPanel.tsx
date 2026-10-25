/**
 * RefereeMappingPanel.tsx — Pinnacle³
 *
 * Step 3/5 — "What can this referee attest to?" Maps a referee to the case's
 * projects and confirmed evidence GROUPS (+ shared worked-together context).
 * Shared by the client portal and the staff portal (each passes its own fetchFn).
 * Input for AI letter generation in Step 6.
 *
 * Evidence is organized as curated groups (Step 5). The referee is mapped to
 * confirmed groups; the group name/description is the attestation label, so there
 * is no per-item label on grouped evidence. An "Individual documents" subsection
 * lets the user attach a still-ungrouped file by giving it a short label — that
 * becomes a confirmed singleton group on save (server-side).
 *
 * Loads: GET /referees/:id/mappings, GET /cases/:caseId/projects,
 *        GET /cases/:caseId/evidence-groups
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
  Loader2, Check, HandHeart, FolderKanban, Layers, FileText, Download, RefreshCw,
  AlertCircle, Lock, Shield, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { criterionLabel } from "@/lib/criterion";

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

interface ProjectOption { id: number; title: string; organization: string | null }
interface EvidenceFileLite {
  id: number; fileName: string; mimeType: string; driveUrl: string;
  criterion: string; isStaffOnly: boolean;
}
interface ConfirmedGroup {
  id: number; name: string; description: string | null; criterion: string | null;
  createdBy: string; members: EvidenceFileLite[];
}

interface MappingData {
  sharedOrganization: string | null;
  sharedPeriod: string | null;
  projects: { projectId: number; attestationNotes: string | null }[];
  groups: {
    evidenceGroupId: number; attestationNotes: string | null;
    name: string; description: string | null; criterion: string | null; memberCount: number;
  }[];
}

type ProjSel = Record<number, { checked: boolean; notes: string }>;
type GrpSel = Record<number, { checked: boolean; notes: string }>;
type FileSel = Record<number, { checked: boolean; label: string; notes: string }>;

function snapshot(
  org: string, period: string, proj: ProjSel, grp: GrpSel, file: FileSel,
): string {
  const p = Object.entries(proj).filter(([, v]) => v.checked).map(([id, v]) => `${id}:${v.notes}`).sort();
  const g = Object.entries(grp).filter(([, v]) => v.checked).map(([id, v]) => `${id}:${v.notes}`).sort();
  const f = Object.entries(file).filter(([, v]) => v.checked).map(([id, v]) => `${id}:${v.label}:${v.notes}`).sort();
  return JSON.stringify({ org, period, p, g, f });
}

const criterionKey = (c: string | null | undefined) => c || "unclassified";

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
  const [confirmedGroups, setConfirmedGroups] = useState<ConfirmedGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<EvidenceFileLite[]>([]);
  const [sharedOrg, setSharedOrg] = useState("");
  const [sharedPeriod, setSharedPeriod] = useState("");
  const [projSel, setProjSel] = useState<ProjSel>({});
  const [grpSel, setGrpSel] = useState<GrpSel>({});
  const [fileSel, setFileSel] = useState<FileSel>({});
  const [openMembers, setOpenMembers] = useState<Record<number, boolean>>({});
  const [savedSnap, setSavedSnap] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const applyMapping = useCallback(
    (mapping: MappingData, projList: ProjectOption[], grps: ConfirmedGroup[], ungr: EvidenceFileLite[]) => {
      setSharedOrg(mapping.sharedOrganization ?? "");
      setSharedPeriod(mapping.sharedPeriod ?? "");

      const pNotes = new Map(mapping.projects.map((p) => [p.projectId, p.attestationNotes ?? ""]));
      const ps: ProjSel = {};
      for (const p of projList) ps[p.id] = { checked: pNotes.has(p.id), notes: pNotes.get(p.id) ?? "" };
      setProjSel(ps);

      const gNotes = new Map(mapping.groups.map((g) => [g.evidenceGroupId, g.attestationNotes ?? ""]));
      const gs: GrpSel = {};
      for (const g of grps) gs[g.id] = { checked: gNotes.has(g.id), notes: gNotes.get(g.id) ?? "" };
      setGrpSel(gs);

      // Ungrouped files always start unchecked — once attached they become
      // confirmed singleton groups and no longer appear here.
      const fs: FileSel = {};
      for (const f of ungr) fs[f.id] = { checked: false, label: "", notes: "" };
      setFileSel(fs);

      setSavedSnap(snapshot(mapping.sharedOrganization ?? "", mapping.sharedPeriod ?? "", ps, gs, fs));
    },
    [],
  );

  const load = useCallback(async (refresh = false) => {
    if (refresh) setSyncing(true); else setLoading(true);
    setError(null);
    try {
      // On an explicit refresh, force a Drive sync first (this also auto-enqueues
      // the AI grouping job server-side); then reload groups.
      if (refresh) {
        await fetchFn(`/cases/${caseId}/evidence-files?refresh=1`).catch(() => undefined);
      }
      const [mapRes, projRes, grpRes] = await Promise.all([
        fetchFn(`/referees/${refereeId}/mappings`).then((r) => r.json()),
        fetchFn(`/cases/${caseId}/projects`).then((r) => r.json()),
        fetchFn(`/cases/${caseId}/evidence-groups`).then((r) => r.json()),
      ]);
      const projList: ProjectOption[] = (projRes.projects ?? []).map((p: ProjectOption) => ({
        id: p.id, title: p.title, organization: p.organization,
      }));
      const grps: ConfirmedGroup[] = grpRes.confirmed ?? [];
      const ungr: EvidenceFileLite[] = grpRes.ungrouped ?? [];
      setProjects(projList);
      setConfirmedGroups(grps);
      setUngrouped(ungr);
      applyMapping(mapRes.mappings as MappingData, projList, grps, ungr);
    } catch {
      setError("Could not load this referee's mapping. Please try again.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [refereeId, caseId, fetchFn, applyMapping]);

  useEffect(() => { void load(false); }, [load]);

  const dirty = useMemo(
    () => snapshot(sharedOrg, sharedPeriod, projSel, grpSel, fileSel) !== savedSnap,
    [sharedOrg, sharedPeriod, projSel, grpSel, fileSel, savedSnap],
  );

  const missingLabels = useMemo(
    () => Object.values(fileSel).some((v) => v.checked && !v.label.trim()),
    [fileSel],
  );

  // Organize confirmed groups + ungrouped files by criterion for display.
  const byCriterion = useMemo(() => {
    const m = new Map<string, { groups: ConfirmedGroup[]; files: EvidenceFileLite[] }>();
    const slot = (k: string) => {
      if (!m.has(k)) m.set(k, { groups: [], files: [] });
      return m.get(k)!;
    };
    for (const g of confirmedGroups) slot(criterionKey(g.criterion)).groups.push(g);
    for (const f of ungrouped) slot(criterionKey(f.criterion)).files.push(f);
    return [...m.entries()].sort(([a], [b]) => {
      if (a === "unclassified") return 1;
      if (b === "unclassified") return -1;
      return criterionLabel(a).localeCompare(criterionLabel(b));
    });
  }, [confirmedGroups, ungrouped]);

  async function handleSave() {
    if (missingLabels) {
      setShowErrors(true);
      toast({ title: "Each attached individual document needs a short label", variant: "destructive" });
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
        groups: Object.entries(grpSel)
          .filter(([, v]) => v.checked)
          .map(([id, v]) => ({ evidenceGroupId: Number(id), attestationNotes: v.notes.trim() || null })),
        individualFiles: Object.entries(fileSel)
          .filter(([, v]) => v.checked)
          .map(([id, v]) => ({ fileId: Number(id), label: v.label.trim(), attestationNotes: v.notes.trim() || null })),
      };
      const r = await fetchFn(`/referees/${refereeId}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      const fresh = d.mappings as MappingData;
      // Reload so freshly created singleton groups appear as confirmed groups.
      await load(false);
      setShowErrors(false);
      onSaved?.({ projects: fresh.projects.length, evidence: fresh.groups.length });
      toast({ title: "Mapping saved" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(f: { id: number; fileName: string }) {
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
  const setGrp = (id: number, patch: Partial<{ checked: boolean; notes: string }>) =>
    setGrpSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const setFile = (id: number, patch: Partial<{ checked: boolean; label: string; notes: string }>) =>
    setFileSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  if (loading) {
    return (
      <div className="rounded-lg border mt-4 p-4 flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-[#1E2D6B]" />
      </div>
    );
  }

  const hasEvidence = confirmedGroups.length > 0 || ungrouped.length > 0;
  const selectedGroupCount = Object.values(grpSel).filter((v) => v.checked).length
    + Object.values(fileSel).filter((v) => v.checked).length;

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

          {/* Evidence groups */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Evidence groups
              </h4>
              <button onClick={() => void load(true)} disabled={syncing}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#1E2D6B] hover:text-[#3D4FA8] disabled:opacity-50"
                title="Re-sync evidence files from Drive">
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> Refresh from Drive
              </button>
            </div>
            {!hasEvidence ? (
              <p className="text-xs text-muted-foreground">
                No evidence yet. Upload documents to the case's Evidence folders in Drive, then Refresh —
                they'll be grouped automatically for curation{staff ? " in the Evidence Groups tab" : ""}.
              </p>
            ) : (
              <Accordion type="multiple" className="rounded-md border divide-y">
                {byCriterion.map(([crit, { groups, files }]) => {
                  const selInCrit = groups.filter((g) => grpSel[g.id]?.checked).length
                    + files.filter((f) => fileSel[f.id]?.checked).length;
                  const total = groups.length + files.length;
                  return (
                    <AccordionItem key={crit} value={crit} className="border-b-0 px-3">
                      <AccordionTrigger className="hover:no-underline text-sm">
                        <span className="font-medium">{criterionLabel(crit)}</span>
                        <span className="ml-auto mr-2 text-[11px] text-muted-foreground">
                          {selInCrit > 0 ? `${selInCrit} selected · ` : ""}
                          {groups.length} group{groups.length !== 1 ? "s" : ""}
                          {files.length > 0 ? ` · ${files.length} loose` : ""}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {/* Confirmed groups */}
                        {groups.length > 0 && (
                          <div className="space-y-2">
                            {groups.map((g) => {
                              const s = grpSel[g.id] ?? { checked: false, notes: "" };
                              const membersOpen = !!openMembers[g.id];
                              return (
                                <div key={g.id} className="rounded-md border px-3 py-2">
                                  <div className="flex items-start gap-2">
                                    <Checkbox checked={s.checked} disabled={readOnly} className="mt-0.5"
                                      onCheckedChange={(c) => setGrp(g.id, { checked: c === true })} />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium min-w-0 truncate">{g.name}</span>
                                        <span className="text-[11px] text-muted-foreground shrink-0">
                                          {g.members.length} file{g.members.length !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      {g.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
                                      )}
                                      {g.members.length > 0 && (
                                        <button type="button"
                                          onClick={() => setOpenMembers((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#1E2D6B] hover:text-[#3D4FA8]">
                                          <ChevronRight className={cn("w-3 h-3 transition-transform", membersOpen && "rotate-90")} />
                                          {membersOpen ? "Hide" : "View"} files
                                        </button>
                                      )}
                                      {membersOpen && (
                                        <ul className="mt-1.5 space-y-1 border-l pl-3">
                                          {g.members.map((m) => (
                                            <li key={m.id} className="flex items-center gap-2">
                                              <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                              <span className="text-xs min-w-0 flex-1 truncate">{m.fileName}</span>
                                              {staff && m.isStaffOnly && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 shrink-0">
                                                  <Shield className="w-2.5 h-2.5" /> staff-only
                                                </span>
                                              )}
                                              <button onClick={() => void handleDownload(m)} disabled={downloadingId === m.id}
                                                className="p-1 text-gray-400 hover:text-[#1E2D6B] shrink-0" title="Download">
                                                {downloadingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                  {s.checked && (
                                    <Textarea value={s.notes} readOnly={readOnly}
                                      onChange={(e) => setGrp(g.id, { notes: e.target.value })}
                                      placeholder="What can this referee say about this group of evidence? (optional)"
                                      className="mt-2 min-h-[52px] resize-none text-sm" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Ungrouped / individual documents */}
                        {files.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                              Individual documents
                            </p>
                            {files.map((f) => {
                              const s = fileSel[f.id] ?? { checked: false, label: "", notes: "" };
                              const labelError = showErrors && s.checked && !s.label.trim();
                              return (
                                <div key={f.id} className="rounded-md border px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox checked={s.checked} disabled={readOnly}
                                      onCheckedChange={(c) => setFile(f.id, { checked: c === true })} />
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
                                          onChange={(e) => setFile(f.id, { label: e.target.value })}
                                          placeholder='Short label, e.g. "IEEE paper on claims automation, 2023"'
                                          className={cn("text-sm", labelError && "border-red-400")} />
                                        {labelError && (
                                          <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> A label is required
                                          </p>
                                        )}
                                      </div>
                                      <Textarea value={s.notes} readOnly={readOnly}
                                        onChange={(e) => setFile(f.id, { notes: e.target.value })}
                                        placeholder="What can this referee say about it? (optional)"
                                        className="min-h-[52px] resize-none text-sm" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {total === 0 && (
                          <p className="text-xs text-muted-foreground">No evidence in this criterion.</p>
                        )}
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
              {selectedGroupCount > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {selectedGroupCount} evidence item{selectedGroupCount !== 1 ? "s" : ""} selected
                </span>
              )}
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
