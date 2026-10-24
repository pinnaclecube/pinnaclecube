/**
 * projects.tsx — Pinnacle³
 *
 * Client "Projects" page — document up to 10 major projects per case, each across
 * 9 EB-1A documentation sections with evidence uploads. Top-level nav item.
 * Resolves the client's case via GET /cases/me.
 */

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Loader2, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown, FolderKanban,
  FileText, CheckCircle2, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProjectEditor, type Project, type ProjectCompletion } from "@/components/projects/ProjectEditor";
import { type LookupItem } from "@/components/projects/ProjectDocuments";

const TOKEN_KEY = "pinnacle_token";
const MAX_PROJECTS = 10;

function clientFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

interface ProjectListItem {
  id: number;
  title: string;
  organization: string | null;
  roleTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  sortOrder: number;
  isLocked: boolean;
  createdBy: string;
  documentCount: number;
  completion: ProjectCompletion;
}

function fmtMonth(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function timeline(p: ProjectListItem): string {
  const start = fmtMonth(p.startDate);
  const end = p.isOngoing ? "Present" : fmtMonth(p.endDate);
  if (!start && !end) return "";
  return [start || "—", end || "—"].join(" – ");
}

export default function Projects() {
  const { toast } = useToast();
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<LookupItem[]>([]);
  const [criticalityLevels, setCriticalityLevels] = useState<LookupItem[]>([]);
  const [categories, setCategories] = useState<LookupItem[]>([]);

  const [editing, setEditing] = useState<Project | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const loadList = useCallback(async (cid: number) => {
    const data = await clientFetch(`/cases/${cid}/projects`).then((r) => r.json());
    setProjects(data.projects ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await clientFetch("/cases/me");
      if (meRes.status === 404) {
        setError("No case has been set up for your account yet. Please contact your advisor.");
        return;
      }
      if (!meRes.ok) throw new Error("case");
      const me = (await meRes.json()) as { caseId: number };
      setCaseId(me.caseId);

      const [et, cl, cat] = await Promise.all([
        clientFetch("/lookups/employment-types").then((r) => r.json()),
        clientFetch("/lookups/criticality-levels").then((r) => r.json()),
        clientFetch("/lookups/project-document-categories").then((r) => r.json()),
      ]);
      setEmploymentTypes(et.employmentTypes ?? []);
      setCriticalityLevels(cl.criticalityLevels ?? []);
      setCategories(cat.projectDocumentCategories ?? []);
      await loadList(me.caseId);
    } catch {
      setError("Something went wrong loading your projects. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loadList]);

  useEffect(() => { void load(); }, [load]);

  async function openProject(id: number) {
    setOpening(id);
    try {
      const r = await clientFetch(`/projects/${id}`);
      if (!r.ok) throw new Error("Could not open project");
      const d = (await r.json()) as { project: Project };
      setEditing(d.project);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not open project", variant: "destructive" });
    } finally {
      setOpening(null);
    }
  }

  async function createProject() {
    const title = newTitle.trim();
    if (!title || caseId === null) return;
    setCreating(true);
    try {
      const r = await clientFetch(`/cases/${caseId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Could not create project");
      setCreateOpen(false);
      setNewTitle("");
      setEditing(d.project as Project); // open the editor immediately
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not create project", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function reorder(index: number, dir: -1 | 1) {
    if (caseId === null) return;
    const target = index + dir;
    if (target < 0 || target >= projects.length) return;
    const next = [...projects];
    [next[index], next[target]] = [next[target], next[index]];
    setProjects(next); // optimistic
    setReordering(true);
    try {
      const r = await clientFetch(`/cases/${caseId}/projects/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((p) => p.id) }),
      });
      if (!r.ok) throw new Error("Reorder failed");
    } catch {
      await loadList(caseId); // revert to server truth
      toast({ title: "Could not reorder", variant: "destructive" });
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || caseId === null) return;
    setDeleting(true);
    try {
      const r = await clientFetch(`/projects/${deleteTarget.id}`, { method: "DELETE" });
      if (r.ok) setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // When the editor reports a change, refetch the list on close so cards reflect
  // updated completion + document counts.
  function closeEditor() {
    setEditing(null);
    if (caseId !== null) void loadList(caseId);
  }

  return (
    <AppLayout>
      {editing ? (
        <div className="max-w-3xl">
          <ProjectEditor
            project={editing}
            fetchFn={clientFetch}
            employmentTypes={employmentTypes}
            criticalityLevels={criticalityLevels}
            categories={categories}
            onBack={closeEditor}
            onChange={setEditing}
          />
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/8 flex items-center justify-center shrink-0 mt-0.5">
                <FolderKanban className="w-5 h-5 text-[#1E2D6B]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Projects</h1>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Document your major projects in depth — the basis for your original-contribution
                  and leading-role evidence. Up to {MAX_PROJECTS} projects.
                </p>
              </div>
            </div>
            {!loading && !error && caseId !== null && (
              <Button
                onClick={() => setCreateOpen(true)}
                disabled={projects.length >= MAX_PROJECTS}
                className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Project
              </Button>
            )}
          </div>

          {projects.length >= MAX_PROJECTS && (
            <p className="text-xs text-amber-600 mb-3 -mt-3">
              You've reached the maximum of {MAX_PROJECTS} projects. Delete one to add another.
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              {error.includes("wrong") && <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>}
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {projects.map((p, i) => (
                <div key={p.id} className="rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => void reorder(i, -1)} disabled={i === 0 || reordering}
                        className="text-gray-300 hover:text-[#1E2D6B] disabled:opacity-30 disabled:hover:text-gray-300" title="Move up">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => void reorder(i, 1)} disabled={i === projects.length - 1 || reordering}
                        className="text-gray-300 hover:text-[#1E2D6B] disabled:opacity-30 disabled:hover:text-gray-300" title="Move down">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <button onClick={() => void openProject(p.id)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.roleTitle, p.organization, timeline(p)].filter(Boolean).join(" · ") || "No details yet"}
                      </p>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={cn(
                        "text-[10px] gap-1",
                        p.completion.complete === p.completion.total
                          ? "border-green-300 text-green-700 bg-green-50"
                          : "border-gray-200 text-gray-500",
                      )}>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {p.completion.complete} of {p.completion.total} sections
                      </Badge>
                      {p.documentCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-indigo-200 text-[#3D4FA8] bg-indigo-50">
                          <FileText className="w-2.5 h-2.5" /> {p.documentCount}
                        </Badge>
                      )}
                      <button onClick={() => void openProject(p.id)} disabled={opening === p.id}
                        className="p-1 text-gray-400 hover:text-[#1E2D6B]" title="Open">
                        {opening === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="p-1 text-gray-300 hover:text-red-600" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-16 border rounded-lg bg-white">
                  <FolderKanban className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No projects added yet.</p>
                  <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" className="mt-3 gap-1.5">
                    <Plus className="w-4 h-4" /> Add your first project
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Quick create */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setNewTitle(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a project</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project title</label>
            <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Real-time fraud detection platform"
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) void createProject(); }} />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              You can fill in all the details next — only a title is needed to start.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setNewTitle(""); }} disabled={creating}>Cancel</Button>
            <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={!newTitle.trim() || creating}
              onClick={() => void createProject()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create & open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title ? `"${deleteTarget.title}"` : "This project"} and all of its
              evidence documents will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
