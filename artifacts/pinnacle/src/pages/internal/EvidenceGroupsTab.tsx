/**
 * EvidenceGroupsTab.tsx — Pinnacle³ (staff case detail)
 *
 * Step 5 — evidence group curation. Review AI suggestions (confirm / edit-then-
 * confirm / reject), manage confirmed groups (edit, add/remove files, dissolve),
 * create groups from ungrouped files, and run the "Suggest groups" batch job.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Sparkles, Check, X, Pencil, Trash2, Plus, FileText, Download,
  FolderPlus, Layers, AlertCircle, RefreshCw, Tags,
} from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { criterionLabel } from "@/lib/criterion";

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

interface Member { id: number; fileName: string; mimeType: string; driveUrl: string; criterion: string; isStaffOnly: boolean }
interface ConfirmedGroup { id: number; name: string; description: string | null; criterion: string | null; createdBy: string; members: Member[] }
interface SuggestedGroup { id: number; name: string; description: string | null; criterion: string | null; aiRationale: string | null; proposedMembers: Member[] }
interface AddSuggestion { id: number; groupId: number; groupName: string; file: Member }
type GroupingJob = { id: number; status: string; newGroups: number | null; addSuggestions: number | null; error: string | null } | null;

interface GroupsData {
  confirmed: ConfirmedGroup[];
  suggested: SuggestedGroup[];
  addSuggestions: AddSuggestion[];
  ungrouped: Member[];
  groupingJob: GroupingJob;
}

async function downloadFile(f: Member, toast: ReturnType<typeof useToast>["toast"]) {
  try {
    const r = await staffFetch(`/evidence-files/${f.id}/download`);
    if (!r.ok) throw new Error("Download failed");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = f.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast({ title: "Download failed", variant: "destructive" });
  }
}

export function EvidenceGroupsTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GroupsData | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Dialog state
  const [editGroup, setEditGroup] = useState<ConfirmedGroup | SuggestedGroup | null>(null);
  const [editIsSuggested, setEditIsSuggested] = useState(false);
  const [addFilesGroup, setAddFilesGroup] = useState<ConfirmedGroup | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUngrouped, setSelectedUngrouped] = useState<Set<number>>(new Set());

  const resolveCase = useCallback(async () => {
    try {
      const r = await staffFetch(`/internal/petition/setup/${userId}`);
      const d = (await r.json()) as { cases?: { setup?: { id: number } }[] };
      return d.cases?.[0]?.setup?.id ?? null;
    } catch { return null; }
  }, [userId]);

  const loadGroups = useCallback(async (cid: number) => {
    const d = (await staffFetch(`/cases/${cid}/evidence-groups`).then((r) => r.json())) as GroupsData;
    setData(d);
  }, []);

  const init = useCallback(async () => {
    setLoading(true); setError(null);
    const cid = await resolveCase();
    if (!cid) { setError("No case has been set up for this client yet."); setLoading(false); return; }
    setCaseId(cid);
    try { await loadGroups(cid); } catch { setError("Could not load evidence groups."); }
    finally { setLoading(false); }
  }, [resolveCase, loadGroups]);

  useEffect(() => { void init(); }, [init]);

  // Poll while a grouping job is in flight.
  const jobActive = data?.groupingJob?.status === "queued" || data?.groupingJob?.status === "processing";
  useEffect(() => {
    if (!jobActive || caseId === null) return;
    const t = setInterval(() => { void loadGroups(caseId); }, 10000);
    return () => clearInterval(t);
  }, [jobActive, caseId, loadGroups]);

  async function act(path: string, opts: RequestInit, okMsg?: string): Promise<boolean> {
    setBusy(path);
    try {
      const r = await staffFetch(path, opts);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = d.referees?.length ? `${d.error} (${d.referees.join(", ")})` : (d.error ?? "Action failed");
        toast({ title: msg, variant: "destructive" });
        return false;
      }
      if (okMsg) toast({ title: okMsg });
      if (caseId !== null) await loadGroups(caseId);
      return true;
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    if (caseId === null) return;
    setSuggesting(true);
    try {
      const r = await staffFetch(`/cases/${caseId}/evidence-groups/suggest`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: d.error ?? "Could not start", variant: "destructive" }); return; }
      toast({ title: d.alreadyRunning ? "Grouping already running" : "Grouping started — proposals appear shortly." });
      await loadGroups(caseId);
    } finally { setSuggesting(false); }
  }

  async function reclassify() {
    if (caseId === null) return;
    setReclassifying(true);
    try {
      const r = await staffFetch(`/cases/${caseId}/evidence-groups/reclassify`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: d.error ?? "Reclassification failed", variant: "destructive" }); return; }
      toast({
        title: `Reclassified ${d.reclassified ?? 0} group${d.reclassified === 1 ? "" : "s"}`,
        description: d.remaining > 0 ? `${d.remaining} still pending — run again to continue.` : undefined,
      });
      await loadGroups(caseId);
    } finally { setReclassifying(false); }
  }

  async function confirmAll() {
    if (!data) return;
    for (const g of data.suggested) {
      await staffFetch(`/evidence-groups/${g.id}/confirm`, { method: "POST" });
    }
    toast({ title: "All suggestions confirmed" });
    if (caseId !== null) await loadGroups(caseId);
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" /></div>;
  if (error) return <div className="text-sm text-muted-foreground py-12 text-center">{error}</div>;
  if (!data) return null;

  // Confirmed groups by criterion.
  const byCriterion = new Map<string, ConfirmedGroup[]>();
  for (const g of data.confirmed) {
    const k = g.criterion ?? "unclassified";
    (byCriterion.get(k) ?? byCriterion.set(k, []).get(k)!).push(g);
  }
  const ungroupedByCriterion = new Map<string, Member[]>();
  for (const f of data.ungrouped) {
    const k = f.criterion ?? "unclassified";
    (ungroupedByCriterion.get(k) ?? ungroupedByCriterion.set(k, []).get(k)!).push(f);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" /> Evidence Groups
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.confirmed.length} group{data.confirmed.length !== 1 ? "s" : ""} · {data.ungrouped.length} ungrouped file{data.ungrouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {jobActive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#1E2D6B]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {data.groupingJob?.status === "processing" ? "Grouping…" : "Queued"}
            </span>
          )}
          {data.groupingJob?.status === "failed" && (
            <span className="text-xs text-red-600">Last grouping failed</span>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void suggest()} disabled={suggesting || jobActive}>
            {suggesting || jobActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Suggest groups
          </Button>
          {data.confirmed.some((g) => !g.criterion || g.criterion === "unclassified") && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void reclassify()} disabled={reclassifying}
              title="Assign criteria to unclassified groups using AI">
              {reclassifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
              Reclassify
            </Button>
          )}
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => caseId !== null && void loadGroups(caseId)}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Suggested review queue */}
      {data.suggested.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
              {data.suggested.length} suggested group{data.suggested.length !== 1 ? "s" : ""} to review
            </h4>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => void confirmAll()}>
              <Check className="w-3 h-3" /> Confirm all
            </Button>
          </div>
          {data.suggested.map((g) => (
            <div key={g.id} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{g.name}</p>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {criterionLabel(g.criterion)} · {g.proposedMembers.length} file{g.proposedMembers.length !== 1 ? "s" : ""}
                  </p>
                  {g.aiRationale && <p className="text-[11px] text-violet-700 italic mt-1">“{g.aiRationale}”</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" className="h-7 text-xs gap-1 bg-[#1E2D6B] hover:bg-[#3D4FA8]" disabled={busy !== null}
                    onClick={() => void act(`/evidence-groups/${g.id}/confirm`, { method: "POST" }, "Group confirmed")}>
                    <Check className="w-3 h-3" /> Confirm
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => { setEditGroup(g); setEditIsSuggested(true); }}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-600" disabled={busy !== null}
                    onClick={() => void act(`/evidence-groups/${g.id}/reject`, { method: "POST" }, "Suggestion rejected")}>
                    <X className="w-3 h-3" /> Reject
                  </Button>
                </div>
              </div>
              <ul className="text-xs text-gray-600 pl-1 space-y-0.5">
                {g.proposedMembers.map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-gray-400" /> {f.fileName}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Add-to-group suggestions */}
      {data.addSuggestions.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
            {data.addSuggestions.length} file{data.addSuggestions.length !== 1 ? "s" : ""} suggested for existing groups
          </h4>
          {data.addSuggestions.map((s) => (
            <div key={s.id} className="rounded-md border px-3 py-2 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs min-w-0 flex-1 truncate">
                Add <span className="font-medium">{s.file.fileName}</span> to <span className="font-medium">{s.groupName}</span>
              </span>
              <Button size="sm" className="h-7 text-xs gap-1 bg-[#1E2D6B] hover:bg-[#3D4FA8]" disabled={busy !== null}
                onClick={() => void act(`/evidence-group-suggestions/${s.id}/accept`, { method: "POST" }, "Added")}>
                <Check className="w-3 h-3" /> Add
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" disabled={busy !== null}
                onClick={() => void act(`/evidence-group-suggestions/${s.id}/reject`, { method: "POST" })}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Confirmed groups by criterion */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmed groups</h4>
        {data.confirmed.length === 0 ? (
          <p className="text-xs text-muted-foreground">No confirmed groups yet.</p>
        ) : (
          <Accordion type="multiple" className="rounded-lg border divide-y">
            {[...byCriterion.entries()].map(([crit, groups]) => (
              <AccordionItem key={crit} value={crit} className="border-b-0 px-3">
                <AccordionTrigger className="hover:no-underline text-sm">
                  <span className="font-medium">{criterionLabel(crit)}</span>
                  <span className="ml-auto mr-2 text-[11px] text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{g.name}
                            {g.createdBy === "ai" && <Badge variant="outline" className="ml-1.5 text-[9px] border-violet-200 text-violet-600">AI</Badge>}
                          </p>
                          {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditGroup(g); setEditIsSuggested(false); }} className="p-1 text-gray-400 hover:text-[#1E2D6B]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setAddFilesGroup(g)} className="p-1 text-gray-400 hover:text-[#1E2D6B]" title="Add files"><Plus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => void act(`/evidence-groups/${g.id}/dissolve`, { method: "POST" }, "Group dissolved")} disabled={busy !== null} className="p-1 text-gray-300 hover:text-red-600" title="Dissolve"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {g.members.map((f) => (
                          <li key={f.id} className="flex items-center gap-1.5 text-xs">
                            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{f.fileName}{f.isStaffOnly && <span className="ml-1 text-amber-600">· staff-only</span>}</span>
                            <button onClick={() => void downloadFile(f, toast)} className="p-0.5 text-gray-400 hover:text-[#1E2D6B]" title="Download"><Download className="w-3 h-3" /></button>
                            <button onClick={() => void act(`/evidence-groups/${g.id}/members`, { method: "PUT", body: JSON.stringify({ remove: [f.id] }) })} disabled={busy !== null} className="p-0.5 text-gray-300 hover:text-red-600" title="Remove from group"><X className="w-3 h-3" /></button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>

      {/* Ungrouped files */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Ungrouped files ({data.ungrouped.length})
          </h4>
          {selectedUngrouped.size > 0 && (
            <Button size="sm" className="h-7 text-xs gap-1 bg-[#1E2D6B] hover:bg-[#3D4FA8]" onClick={() => setCreateOpen(true)}>
              <FolderPlus className="w-3 h-3" /> Create group from {selectedUngrouped.size} selected
            </Button>
          )}
        </div>
        {data.ungrouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ungrouped files.</p>
        ) : (
          <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
            {[...ungroupedByCriterion.entries()].map(([crit, files]) => (
              <div key={crit} className="px-3 py-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{criterionLabel(crit)}</p>
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <Checkbox checked={selectedUngrouped.has(f.id)}
                      onCheckedChange={(c) => setSelectedUngrouped((prev) => { const n = new Set(prev); if (c === true) n.add(f.id); else n.delete(f.id); return n; })} />
                    <span className="text-xs min-w-0 flex-1 truncate">{f.fileName}{f.isStaffOnly && <span className="ml-1 text-amber-600">· staff-only</span>}</span>
                    <button onClick={(e) => { e.preventDefault(); void downloadFile(f, toast); }} className="p-0.5 text-gray-400 hover:text-[#1E2D6B]"><Download className="w-3 h-3" /></button>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit group dialog */}
      <EditGroupDialog
        group={editGroup} isSuggested={editIsSuggested} caseId={caseId}
        onClose={() => setEditGroup(null)}
        onDone={() => { setEditGroup(null); if (caseId !== null) void loadGroups(caseId); }}
      />

      {/* Add files dialog */}
      <AddFilesDialog
        group={addFilesGroup} ungrouped={data.ungrouped}
        onClose={() => setAddFilesGroup(null)}
        onDone={() => { setAddFilesGroup(null); if (caseId !== null) void loadGroups(caseId); }}
      />

      {/* Create group dialog */}
      <CreateGroupDialog
        open={createOpen} caseId={caseId} fileIds={[...selectedUngrouped]}
        ungrouped={data.ungrouped}
        onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); setSelectedUngrouped(new Set()); if (caseId !== null) void loadGroups(caseId); }}
      />
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────────

function EditGroupDialog({ group, isSuggested, onClose, onDone }: {
  group: ConfirmedGroup | SuggestedGroup | null; isSuggested: boolean; caseId: number | null;
  onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const members = group ? ("proposedMembers" in group ? group.proposedMembers : group.members) : [];

  useEffect(() => {
    if (group) { setName(group.name); setDescription(group.description ?? ""); setExcluded(new Set()); }
  }, [group]);

  async function save() {
    if (!group) return;
    setSaving(true);
    try {
      await staffFetch(`/evidence-groups/${group.id}`, { method: "PUT", body: JSON.stringify({ name: name.trim(), description: description.trim() || null }) });
      if (isSuggested) {
        await staffFetch(`/evidence-groups/${group.id}/confirm`, { method: "POST" });
        const remove = [...excluded];
        if (remove.length > 0) await staffFetch(`/evidence-groups/${group.id}/members`, { method: "PUT", body: JSON.stringify({ remove }) });
        toast({ title: "Group confirmed" });
      } else {
        toast({ title: "Group updated" });
      }
      onDone();
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isSuggested ? "Edit & confirm group" : "Edit group"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px] resize-none text-sm" />
          </div>
          {isSuggested && members.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Members (uncheck to exclude)</label>
              <div className="rounded border divide-y mt-1">
                {members.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                    <Checkbox checked={!excluded.has(f.id)}
                      onCheckedChange={(c) => setExcluded((prev) => { const n = new Set(prev); if (c === true) n.delete(f.id); else n.add(f.id); return n; })} />
                    <span className="text-xs truncate">{f.fileName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={!name.trim() || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isSuggested ? "Confirm" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddFilesDialog({ group, ungrouped, onClose, onDone }: {
  group: ConfirmedGroup | null; ungrouped: Member[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSel(new Set()); }, [group]);

  async function save() {
    if (!group || sel.size === 0) return;
    setSaving(true);
    try {
      const r = await staffFetch(`/evidence-groups/${group.id}/members`, { method: "PUT", body: JSON.stringify({ add: [...sel] }) });
      if (!r.ok) throw new Error();
      toast({ title: "Files added" });
      onDone();
    } catch { toast({ title: "Could not add files", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add files to “{group?.name}”</DialogTitle></DialogHeader>
        {ungrouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ungrouped files available.</p>
        ) : (
          <div className="rounded border divide-y max-h-72 overflow-y-auto">
            {ungrouped.map((f) => (
              <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
                <Checkbox checked={sel.has(f.id)} onCheckedChange={(c) => setSel((prev) => { const n = new Set(prev); if (c === true) n.add(f.id); else n.delete(f.id); return n; })} />
                <span className="text-xs truncate">{f.fileName}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={sel.size === 0 || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add {sel.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupDialog({ open, caseId, fileIds, ungrouped, onClose, onDone }: {
  open: boolean; caseId: number | null; fileIds: number[]; ungrouped: Member[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const criterion = ungrouped.find((f) => fileIds.includes(f.id))?.criterion ?? null;
  useEffect(() => { if (open) { setName(""); setDescription(""); } }, [open]);

  async function save() {
    if (caseId === null || !name.trim()) return;
    setSaving(true);
    try {
      const r = await staffFetch(`/cases/${caseId}/evidence-groups`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, criterionFolder: criterion, fileIds }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Group created" });
      onDone();
    } catch { toast({ title: "Could not create group", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create group from {fileIds.length} file{fileIds.length !== 1 ? "s" : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Group name</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "SCRS Fellow Certification 2024"' />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[52px] resize-none text-sm" />
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Criterion: {criterionLabel(criterion)}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={!name.trim() || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
