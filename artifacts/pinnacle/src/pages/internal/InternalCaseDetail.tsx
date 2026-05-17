import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { AIBadge } from "@/components/disclaimers/AIBadge";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  ArrowLeft, Plus, Check, AlertTriangle, Lock,
  RefreshCw, ExternalLink, Loader2, CheckCircle, Clock, Zap, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderBrowser } from "@/components/case/FolderBrowser";
import { PetitionAssessmentTab } from "./PetitionAssessmentTab";
import { ExhibitsTab } from "./ExhibitsTab";

const TABS = ["Overview", "Evidence", "Excellence Lab", "Petition Workspace", "Petition Assessment", "Exhibits", "Documents", "Drive Folders"] as const;
type Tab = typeof TABS[number];

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

function statusColor(status: string) {
  switch (status) {
    case "not_started": return "bg-gray-100 text-gray-600";
    case "generating": return "bg-blue-100 text-blue-700";
    case "draft": return "bg-yellow-100 text-yellow-700";
    case "approved": case "active": case "completed": case "published": return "bg-green-100 text-green-700";
    case "invalidated": return "bg-orange-100 text-orange-700";
    case "pending": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", statusColor(status))}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Tab 1: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ userId, data, onReload }: { userId: string; data: any; onReload: () => void }) {
  const { profile, intake, resume } = data;
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    staffFetch(`/admin/profiles/${userId}/action-items`)
      .then((r) => r.json())
      .then((d) => setActionItems(d.actionItems ?? []));
  }, [userId]);

  const createActionItem = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await staffFetch(`/admin/profiles/${userId}/action-items`, {
        method: "POST",
        body: JSON.stringify({ title: newTitle, description: newDesc, priority: newPriority }),
      });
      const d = await r.json();
      if (d.actionItem) { setActionItems((prev) => [d.actionItem, ...prev]); }
      setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setShowNewItem(false);
    } finally { setSaving(false); }
  };

  const updateStatus = async (aid: number, status: string) => {
    const r = await staffFetch(`/admin/profiles/${userId}/action-items/${aid}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (d.actionItem) setActionItems((prev) => prev.map((a) => a.id === aid ? d.actionItem : a));
  };

  const resetPassword = async () => {
    if (newPassword.length < 8) return;
    setSaving(true);
    try {
      await staffFetch(`/admin/profiles/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setShowResetPw(false); setNewPassword("");
      alert("Password reset successfully.");
    } finally { setSaving(false); }
  };

  const deleteCase = async () => {
    await staffFetch(`/admin/profiles/${userId}`, { method: "DELETE" });
    window.location.href = "/internal/cases";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center text-[#1E2D6B] font-bold text-lg">
                {(profile.name ?? profile.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{profile.name ?? "Unknown"}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Visa Target", profile.visaTarget?.toUpperCase()],
                ["Access Level", profile.accessLevel?.replace(/_/g, " ")],
                ["Profession", profile.profession],
                ["Member Since", profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"],
              ] as [string, string][]).map(([k, v]) => v ? (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-medium capitalize">{v}</p>
                </div>
              ) : null)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Readiness Intake</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!intake ? (
              <p className="text-muted-foreground italic">Not completed yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-medium text-xs">Intake submitted</span>
                </div>
                {([
                  ["Current Role", intake.currentRole],
                  ["Company", intake.company],
                  ["Field", intake.fieldOfWork],
                  ["Experience", intake.yearsExperience],
                  ["Country", intake.country],
                  ["Education", intake.education],
                ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right truncate max-w-[180px]">{v}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resume</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {!resume ? (
              <p className="text-muted-foreground italic">No resume uploaded.</p>
            ) : (
              <>
                <p className="font-medium">{resume.fileName ?? "Resume"}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {resume.uploadDate ? new Date(resume.uploadDate).toLocaleDateString() : "—"} ·{" "}
                  <span className={cn("capitalize", resume.extractionStatus === "complete" ? "text-green-600" : "text-yellow-600")}>
                    {resume.extractionStatus}
                  </span>
                </p>
                {resume.extractedText && (
                  <details>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Preview extracted text</summary>
                    <p className="mt-1 text-xs font-mono bg-gray-50 p-2 rounded border max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {resume.extractedText.slice(0, 600)}{resume.extractedText.length > 600 ? "…" : ""}
                    </p>
                  </details>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Items</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNewItem(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {showNewItem && (
              <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                <Input placeholder="Item title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-sm h-8" />
                <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-sm min-h-[50px]" />
                <div className="flex items-center gap-2">
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 text-xs bg-[#1E2D6B] hover:bg-[#3D4FA8]" onClick={createActionItem} disabled={saving || !newTitle.trim()}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewItem(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {actionItems.length === 0 && !showNewItem ? (
              <p className="text-muted-foreground text-sm italic">No action items yet.</p>
            ) : actionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={item.status} />
                    <span className={cn("text-xs font-medium", item.priority === "high" ? "text-red-600" : item.priority === "medium" ? "text-yellow-600" : "text-gray-400")}>
                      {item.priority}
                    </span>
                  </div>
                </div>
                <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                  <SelectTrigger className="h-6 text-xs w-24 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t">
        <Link href={`/internal/case/${userId}/activity-log`}>
          <Button variant="outline" size="sm">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Activity Log
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => setShowResetPw(true)}>Reset Password</Button>
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>Delete Case</Button>
      </div>

      <Dialog open={showResetPw} onOpenChange={setShowResetPw}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">New password for {profile.email}</p>
            <Input type="text" placeholder="New password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPw(false)}>Cancel</Button>
            <Button onClick={resetPassword} disabled={saving || newPassword.length < 8} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {saving ? "Saving…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Case</DialogTitle></DialogHeader>
          <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded p-3 my-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-sm">Permanently deletes all data for <strong>{profile.name ?? profile.email}</strong>. Cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCase}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Evidence ────────────────────────────────────────────────────────────

function EvidenceTab({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteriaOptions, setCriteriaOptions] = useState<any[]>([]);
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});
  const [reclassifyTarget, setReclassifyTarget] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const reload = useCallback(async () => {
    const r = await staffFetch(`/admin/profiles/${userId}/evidence`);
    const d = await r.json();
    setGroups(d.evidence ?? []);
  }, [userId]);

  useEffect(() => {
    Promise.all([
      staffFetch(`/admin/profiles/${userId}/evidence`).then((r) => r.json()),
      staffFetch("/criteria").then((r) => r.json()),
    ]).then(([ev, cr]) => {
      setGroups(ev.evidence ?? []);
      setCriteriaOptions(cr.criteria ?? []);
      setLoading(false);
    });
  }, [userId]);

  const saveNote = async (eid: number) => {
    const note = noteInput[eid];
    if (!note?.trim()) return;
    setSaving((p) => ({ ...p, [eid]: true }));
    try {
      await staffFetch(`/admin/profiles/${userId}/evidence/${eid}`, { method: "PATCH", body: JSON.stringify({ note }) });
      setNoteInput((p) => ({ ...p, [eid]: "" }));
      await reload();
    } finally { setSaving((p) => ({ ...p, [eid]: false })); }
  };

  const reclassify = async (eid: number) => {
    const newCriteriaId = reclassifyTarget[eid];
    if (!newCriteriaId) return;
    setSaving((p) => ({ ...p, [eid]: true }));
    try {
      await staffFetch(`/admin/profiles/${userId}/evidence/${eid}`, { method: "PATCH", body: JSON.stringify({ primaryCriteriaId: newCriteriaId }) });
      await reload();
    } finally { setSaving((p) => ({ ...p, [eid]: false })); }
  };

  const regenerateAI = async (eid: number) => {
    setSaving((p) => ({ ...p, [eid]: true }));
    try {
      await staffFetch(`/admin/profiles/${userId}/evidence/${eid}/regenerate-ai`, { method: "POST" });
    } finally { setSaving((p) => ({ ...p, [eid]: false })); }
  };

  if (loading) return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      {groups.length === 0 && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No evidence items yet. Have the client upload files via the portal.</p></CardContent></Card>
      )}

      {groups.map((group: any) => (
        <div key={group.criteriaId}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-[#1E2D6B]">{group.criteriaId === "uncategorized" ? "Uncategorized" : group.criteriaId}</h3>
            <Badge variant="secondary">{group.items.length}</Badge>
          </div>
          <div className="space-y-3">
            {group.items.map((item: any) => (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{item.title}</p>
                        <StatusBadge status={item.status} />
                        <Badge variant="outline" className="text-xs">{item.evidenceType}</Badge>
                        {item.extractionStatus && (
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                            item.extractionStatus === "completed" ? "bg-green-50 text-green-700" :
                            item.extractionStatus === "failed" ? "bg-red-50 text-red-700" :
                            item.extractionStatus === "skipped" ? "bg-gray-50 text-gray-400" :
                            "bg-gray-50 text-gray-500")}>
                            {item.extractionStatus === "completed" ? "Extracted" :
                             item.extractionStatus === "failed" ? "Extract failed" :
                             item.extractionStatus === "skipped" ? "Binary file" : "Pending extract"}
                          </span>
                        )}
                      </div>
                      {item.fileName && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{item.fileName}</p>
                      )}
                      {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Regenerate AI summary"
                        onClick={() => regenerateAI(item.id)} disabled={saving[item.id]}>
                        <RefreshCw className={cn("w-3 h-3", saving[item.id] && "animate-spin")} />
                      </Button>
                    </div>
                  </div>

                  {item.aiSummary && !item.aiSummaryIgnored && (
                    <AIOutputBanner variant="summary" className="text-xs">
                      <div className="flex items-start gap-1.5">
                        <AIBadge />
                        <span>{item.aiSummary}</span>
                      </div>
                    </AIOutputBanner>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reclassify Criteria</p>
                    <div className="flex items-center gap-2">
                      <Select value={reclassifyTarget[item.id] ?? item.primaryCriteriaId ?? ""} onValueChange={(v) => setReclassifyTarget((p) => ({ ...p, [item.id]: v }))}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select new criteria" /></SelectTrigger>
                        <SelectContent>
                          {criteriaOptions.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.id} — {c.name ?? c.criteriaName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-7 text-xs bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                        onClick={() => reclassify(item.id)} disabled={saving[item.id] || !reclassifyTarget[item.id]}>
                        Apply
                      </Button>
                    </div>

                    {item.internalNotes?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff Notes</p>
                        {item.internalNotes.map((n: any) => (
                          <div key={n.id} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <p className="text-xs">{n.note}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Input className="h-7 text-xs flex-1" placeholder="Add internal note…"
                        value={noteInput[item.id] ?? ""}
                        onChange={(e) => setNoteInput((p) => ({ ...p, [item.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveNote(item.id)} />
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => saveNote(item.id)} disabled={!noteInput[item.id]?.trim()}>
                        Add Note
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 3: Excellence Lab ──────────────────────────────────────────────────────

function ExcellenceLabTab({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState(false);

  useEffect(() => {
    staffFetch(`/admin/profiles/${userId}/course-progress`)
      .then((r) => r.json())
      .then((d) => { setCourses(d.courses ?? []); setPlan(d.plan ?? null); setLoading(false); });
  }, [userId]);

  const invalidateLessons = async () => {
    setInvalidating(true);
    try {
      await staffFetch(`/admin/lessons/invalidate/${userId}`, { method: "POST" });
      const r = await staffFetch(`/admin/profiles/${userId}/course-progress`);
      const d = await r.json();
      setCourses(d.courses ?? []); setPlan(d.plan ?? null);
    } finally { setInvalidating(false); }
  };

  if (loading) return <div className="h-40 bg-gray-200 rounded animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Learning Plan</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={invalidateLessons} disabled={invalidating}>
            {invalidating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Invalidate & Regenerate
          </Button>
        </CardHeader>
        <CardContent>
          {!plan ? <p className="text-sm text-muted-foreground italic">No learning plan yet.</p> : (
            <div className="flex items-center gap-3 text-sm">
              <StatusBadge status={plan.status ?? "unknown"} />
              {plan.lastInvalidatedAt && (
                <span className="text-xs text-muted-foreground">Last invalidated: {new Date(plan.lastInvalidatedAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {courses.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No courses.</p></CardContent></Card>
      ) : courses.map((course: any) => (
        <Card key={course.id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{course.title}</p>
              <p className="text-xs text-muted-foreground">{course.visaType?.toUpperCase()} · {course.totalLessons} lessons</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-[#1E2D6B]">{course.percentComplete}%</p>
                <p className="text-xs text-muted-foreground">{course.completedLessons}/{course.totalLessons}</p>
              </div>
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1E2D6B] rounded-full" style={{ width: `${course.percentComplete}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tab 4: Petition Workspace ──────────────────────────────────────────────────

function PetitionWorkspaceTab({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visaCriteria, setVisaCriteria] = useState<any[]>([]);
  const [setupVisaPath, setSetupVisaPath] = useState("eb1a");
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [exhibitStyle, setExhibitStyle] = useState("numeric");
  const [creatingSetup, setCreatingSetup] = useState(false);
  const [showRecoModal, setShowRecoModal] = useState(false);
  const [recoForm, setRecoForm] = useState({ name: "", title: "", org: "", relationship: "", credentials: "", criteriaSupported: [] as string[] });
  const [addingReco, setAddingReco] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await staffFetch(`/internal/petition/setup/${userId}`);
      if (r.ok) setData(await r.json());
      else setData(null);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    staffFetch(`/criteria`).then((r) => r.json()).then((d) => setVisaCriteria(d.criteria ?? []));
  }, []);

  const createSetup = async () => {
    setCreatingSetup(true);
    try {
      const r = await staffFetch("/internal/petition/setup", {
        method: "POST",
        body: JSON.stringify({ userId: parseInt(userId), visaPath: setupVisaPath, selectedCriteria, exhibitNumberingStyle: exhibitStyle }),
      });
      if (r.ok) await load();
    } finally { setCreatingSetup(false); }
  };

  const doAction = async (key: string, path: string) => {
    setBusy((p) => ({ ...p, [key]: true }));
    try { await staffFetch(path, { method: "POST" }); await load(); }
    finally { setBusy((p) => ({ ...p, [key]: false })); }
  };

  const addReco = async () => {
    setAddingReco(true);
    try {
      await staffFetch("/internal/petition/reco-letters", {
        method: "POST",
        body: JSON.stringify({ caseSetupId: data.setup.id, profileId: parseInt(userId), ...recoForm }),
      });
      setShowRecoModal(false);
      setRecoForm({ name: "", title: "", org: "", relationship: "", credentials: "", criteriaSupported: [] });
      await load();
    } finally { setAddingReco(false); }
  };

  const publishFull = async () => {
    setPublishing(true);
    try {
      await staffFetch(`/internal/petition/package/${data.setup.id}/publish-full`, { method: "POST" });
      setShowPublishConfirm(false); await load();
    } finally { setPublishing(false); }
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />)}</div>;

  if (!data?.setup) {
    const filtered = visaCriteria.filter((c: any) => c.visaPath === setupVisaPath || c.visa_path === setupVisaPath);
    return (
      <Card>
        <CardHeader><CardTitle>Create Petition Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Visa Path</label>
            <Select value={setupVisaPath} onValueChange={setSetupVisaPath}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eb1a">EB-1A</SelectItem>
                <SelectItem value="niw">EB-2 NIW</SelectItem>
                <SelectItem value="o1">O-1A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Criteria ({selectedCriteria.length} selected)
            </label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto border rounded p-2">
              {filtered.length === 0 ? <p className="text-xs text-muted-foreground p-2">Loading criteria…</p> : filtered.map((c: any) => (
                <label key={c.id} className="flex items-start gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded">
                  <Checkbox checked={selectedCriteria.includes(c.id)}
                    onCheckedChange={(checked) =>
                      setSelectedCriteria((prev) => checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))
                    } />
                  <span className="text-sm"><span className="font-medium">{c.criteriaCode}</span> — {c.criteriaName}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Exhibit Numbering</label>
            <Select value={exhibitStyle} onValueChange={setExhibitStyle}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric (1, 2, 3)</SelectItem>
                <SelectItem value="alpha">Alpha (A, B, C)</SelectItem>
                <SelectItem value="roman">Roman (I, II, III)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createSetup} disabled={creatingSetup || selectedCriteria.length === 0} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
            {creatingSetup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Create Petition Setup
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { setup, exhibits = [], recoLetters = [], package: pkg } = data;
  const approvedCount = exhibits.filter((e: any) => e.status === "approved").length;
  const allApproved = approvedCount === exhibits.length && exhibits.length > 0;
  const indexApproved = pkg?.exhibitIndexStatus === "approved";
  const coverApproved = pkg?.coverLetterStatus === "approved";

  return (
    <div className="space-y-8">
      {/* Case setup metadata row */}
      <div className="flex items-center gap-3 flex-wrap">
        {setup.product && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-[#1E2D6B]">
            {{
              evidence_engine: "Evidence Engine",
              elite_blueprint: "Elite Blueprint",
              both: "Evidence Engine + Elite Blueprint",
            }[setup.product as string] ?? setup.product}
          </span>
        )}
        {setup.visaPath && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700">
            {{ eb1a: "EB-1A", niw: "EB-2 NIW", o1: "O-1A" }[setup.visaPath as string] ?? setup.visaPath.toUpperCase()}
          </span>
        )}
        {setup.caseActivationEmailStatus === "sent" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 border border-green-200 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Activation email sent{setup.caseActivationEmailSentAt ? ` · ${new Date(setup.caseActivationEmailSentAt).toLocaleDateString()}` : ""}
          </span>
        )}
        {setup.caseActivationEmailStatus === "failed" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            Activation email failed — check server logs
          </span>
        )}
        {!setup.caseActivationEmailStatus && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-500">
            Activation email pending
          </span>
        )}
      </div>

      {/* Criteria Exhibit Board */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#1E2D6B]">Criteria Exhibits</h3>
          <span className="text-sm text-muted-foreground">{approvedCount}/{exhibits.length} approved</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4 overflow-hidden">
          <div className="bg-[#1E2D6B] h-full rounded-full transition-all" style={{ width: exhibits.length > 0 ? `${(approvedCount / exhibits.length) * 100}%` : "0%" }} />
        </div>
        <div className="space-y-3">
          {exhibits.map((ex: any) => (
            <Card key={ex.id} className={cn("border-l-4", ex.status === "approved" ? "border-l-green-500" : ex.status === "generating" ? "border-l-blue-400" : ex.status === "draft" ? "border-l-yellow-400" : "border-l-gray-200")}>
              <CardContent className="p-4 flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm">Exhibit {ex.exhibitNumber} — {ex.criteriaName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={ex.status} />
                    <span className="text-xs text-muted-foreground">{(ex.evidenceItemIds as any[]).length} items</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => doAction(`gen-${ex.id}`, `/internal/petition/criteria/${ex.id}/generate`)}
                    disabled={busy[`gen-${ex.id}`] || ex.status === "generating" || ex.status === "approved"}>
                    {busy[`gen-${ex.id}`] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}Generate
                  </Button>
                  {ex.status === "draft" && (
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => doAction(`approve-${ex.id}`, `/internal/petition/criteria/${ex.id}/approve`)}
                      disabled={busy[`approve-${ex.id}`]}>
                      <Check className="w-3 h-3 mr-1" />Approve
                    </Button>
                  )}
                  {(ex.status === "draft" || ex.status === "approved") && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => doAction(`regen-${ex.id}`, `/internal/petition/criteria/${ex.id}/regenerate`)}
                      disabled={busy[`regen-${ex.id}`]}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recommendation Letters */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#1E2D6B]">Recommendation Letters</h3>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRecoModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Recommender
          </Button>
        </div>
        {recoLetters.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No recommenders yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {recoLetters.map((letter: any) => (
              <Card key={letter.id} className={cn("border-l-4", letter.status === "approved" ? "border-l-green-500" : letter.status === "generating" ? "border-l-blue-400" : letter.status === "draft" ? "border-l-yellow-400" : "border-l-gray-200")}>
                <CardContent className="p-4 flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">{letter.recommenderName}</p>
                    <p className="text-xs text-muted-foreground">{letter.recommenderTitle} · {letter.recommenderOrg}</p>
                    <StatusBadge status={letter.status} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => doAction(`reco-gen-${letter.id}`, `/internal/petition/reco-letters/${letter.id}/generate`)}
                      disabled={busy[`reco-gen-${letter.id}`] || letter.status === "generating" || letter.status === "approved"}>
                      <Zap className="w-3 h-3 mr-1" />Generate
                    </Button>
                    {letter.status === "draft" && (
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => doAction(`reco-approve-${letter.id}`, `/internal/petition/reco-letters/${letter.id}/approve`)}
                        disabled={busy[`reco-approve-${letter.id}`]}>
                        <Check className="w-3 h-3 mr-1" />Approve
                      </Button>
                    )}
                    {letter.status === "approved" && !letter.publishedToClient && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => doAction(`reco-pub-${letter.id}`, `/internal/petition/reco-letters/${letter.id}/publish`)}
                        disabled={busy[`reco-pub-${letter.id}`]}>
                        Publish to Client
                      </Button>
                    )}
                    {letter.publishedToClient && <Badge className="text-xs bg-green-100 text-green-700 border-0">Published</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Final Package */}
      <section>
        <h3 className="font-semibold text-[#1E2D6B] mb-3">Final Package</h3>
        <div className="space-y-3">
          <div className={cn("flex items-center gap-3 p-3 rounded-lg border", allApproved ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50")}>
            {allApproved ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : <Clock className="w-4 h-4 text-gray-400 shrink-0" />}
            <p className="text-sm font-medium">All criteria exhibits approved ({approvedCount}/{exhibits.length})</p>
          </div>

          {[
            {
              key: "index",
              label: "Exhibit Index",
              status: pkg?.exhibitIndexStatus ?? "not_started",
              locked: !allApproved,
              genPath: `/internal/petition/package/${setup.id}/generate-index`,
              approvePath: `/internal/petition/package/${setup.id}/approve-index`,
            },
            {
              key: "cover",
              label: "Cover Letter",
              status: pkg?.coverLetterStatus ?? "not_started",
              locked: !indexApproved,
              genPath: `/internal/petition/package/${setup.id}/generate-cover`,
              approvePath: `/internal/petition/package/${setup.id}/approve-cover`,
            },
          ].map((step) => (
            <div key={step.key} className={cn("p-3 rounded-lg border", step.locked && "opacity-50")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {step.locked && <Lock className="w-4 h-4 text-gray-400" />}
                  <p className="text-sm font-medium">{step.label}</p>
                  <StatusBadge status={step.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    disabled={step.locked || busy[`gen-${step.key}`] || step.status === "generating"}
                    onClick={() => doAction(`gen-${step.key}`, step.genPath)}>
                    <Zap className="w-3 h-3 mr-1" />Generate
                  </Button>
                  {step.status === "draft" && (
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      disabled={busy[`approve-${step.key}`]}
                      onClick={() => doAction(`approve-${step.key}`, step.approvePath)}>
                      <Check className="w-3 h-3 mr-1" />Approve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {setup.visaPath === "o1" && (
            <div className={cn("p-3 rounded-lg border", !indexApproved && "opacity-50")}>
              <div className="flex items-center gap-2">
                {!indexApproved && <Lock className="w-4 h-4 text-gray-400" />}
                <p className="text-sm font-medium">Employment Itinerary (O-1)</p>
                <StatusBadge status={pkg?.o1ItineraryStatus ?? "not_started"} />
              </div>
            </div>
          )}

          <div className={cn("p-4 rounded-lg border-2 text-center", !coverApproved ? "opacity-50 border-dashed border-gray-300" : "border-[#1E2D6B] bg-[#1E2D6B]/5")}>
            {pkg?.packagePublishedAt ? (
              <div className="flex items-center justify-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <p className="font-semibold">Package Published {new Date(pkg.packagePublishedAt).toLocaleDateString()}</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-2 text-[#1E2D6B]">Publish Full Package to Client</p>
                <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]" disabled={!coverApproved} onClick={() => setShowPublishConfirm(true)}>
                  Publish Package ({exhibits.length + recoLetters.length + 2} documents)
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Add Recommender Modal */}
      <Dialog open={showRecoModal} onOpenChange={setShowRecoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Recommender</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {(["name", "title", "org", "relationship", "credentials"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs font-medium text-muted-foreground capitalize block mb-1">{field}</label>
                <Input value={(recoForm as any)[field]} onChange={(e) => setRecoForm((p) => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}
            {exhibits.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Criteria Supported</label>
                <div className="space-y-1 max-h-36 overflow-y-auto border rounded p-2">
                  {exhibits.map((ex: any) => (
                    <label key={ex.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={recoForm.criteriaSupported.includes(ex.criteriaId)}
                        onCheckedChange={(checked) =>
                          setRecoForm((p) => ({
                            ...p,
                            criteriaSupported: checked ? [...p.criteriaSupported, ex.criteriaId] : p.criteriaSupported.filter((x) => x !== ex.criteriaId),
                          }))} />
                      {ex.criteriaName}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecoModal(false)}>Cancel</Button>
            <Button onClick={addReco} disabled={addingReco || !recoForm.name || !recoForm.title} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {addingReco ? "Adding…" : "Add Recommender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish Full Package</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Publishes <strong>{exhibits.length + recoLetters.length + 2} documents</strong> to the client. Cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
            <Button onClick={publishFull} disabled={publishing} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Publish Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 5: Documents ───────────────────────────────────────────────────────────

function DocumentsTab({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genSubtype, setGenSubtype] = useState("");
  const [genContext, setGenContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const loadDocs = useCallback(async () => {
    const r = await staffFetch(`/admin/profiles/${userId}/documents`);
    const d = await r.json();
    setDocs(d.documents ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const generateDoc = async () => {
    setGenerating(true);
    try {
      await staffFetch(`/admin/profiles/${userId}/documents`, {
        method: "POST",
        body: JSON.stringify({ docSubtype: genSubtype, staffContextInput: genContext ? { notes: genContext } : {} }),
      });
      setShowGenModal(false); setGenSubtype(""); setGenContext("");
      await loadDocs();
    } finally { setGenerating(false); }
  };

  const togglePublish = async (docId: number, publish: boolean) => {
    setBusy((p) => ({ ...p, [docId]: true }));
    try {
      await staffFetch(`/admin/documents/${docId}/${publish ? "publish" : "unpublish"}`, { method: "PATCH" });
      await loadDocs();
    } finally { setBusy((p) => ({ ...p, [docId]: false })); }
  };

  if (loading) return <div className="h-40 bg-gray-200 rounded animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">All Documents ({docs.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setShowGenModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Generate Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No documents yet.</p></CardContent></Card>
      ) : docs.map((doc: any) => (
        <Card key={doc.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium capitalize">{doc.docSubtype.replace(/_/g, " ")}</p>
                <StatusBadge status={doc.publishedToClient ? "published" : doc.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{new Date(doc.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!doc.publishedToClient && doc.status !== "pending" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => togglePublish(doc.id, true)} disabled={busy[doc.id]}>Publish</Button>
              )}
              {doc.publishedToClient && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => togglePublish(doc.id, false)} disabled={busy[doc.id]}>Unpublish</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showGenModal} onOpenChange={setShowGenModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Document Type</label>
              <Select value={genSubtype} onValueChange={setGenSubtype}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover_letter">Cover Letter</SelectItem>
                  <SelectItem value="exhibit_index">Exhibit Index</SelectItem>
                  <SelectItem value="reco_letter">Recommendation Letter</SelectItem>
                  <SelectItem value="criteria_exhibit">Criteria Exhibit</SelectItem>
                  <SelectItem value="employment_itinerary">Employment Itinerary (O-1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Staff Context Notes</label>
              <Textarea value={genContext} onChange={(e) => setGenContext(e.target.value)} placeholder="Additional context for the AI generator…" className="min-h-[70px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenModal(false)}>Cancel</Button>
            <Button onClick={generateDoc} disabled={generating || !genSubtype} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {generating ? "Queuing…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 6: Drive Folders ────────────────────────────────────────────────────────

function DriveFoldersTab({ userId }: { userId: string }) {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    staffFetch(`/internal/petition/setup/${userId}`)
      .then((r) => r.json())
      .then((d: any) => {
        const id = d.cases?.[0]?.setup?.id;
        if (id) setCaseId(id);
        else setError("No case setup found for this client.");
      })
      .catch(() => setError("Failed to load case info."))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="h-40 bg-gray-200 rounded animate-pulse" />;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (caseId === null) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Create subfolders and upload documents directly into the client's Drive case folders.
        Files are immediately synced to Google Drive.
      </p>
      <FolderBrowser caseId={caseId} fetchFn={staffFetch} isStaff />
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function InternalCaseDetail() {
  const { user_id } = useParams() as { user_id: string };
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const r = await staffFetch(`/admin/profiles/${user_id}`);
      if (r.ok) setProfileData(await r.json());
    } finally { setLoading(false); }
  }, [user_id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        </main>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <Link href="/internal/cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Cases
          </Link>
          <p className="text-muted-foreground">Profile not found.</p>
        </main>
      </div>
    );
  }

  const { profile } = profileData;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <Link href="/internal/cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Cases
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{profile.name ?? "Unknown Client"}</h1>
            <p className="text-muted-foreground text-sm">{profile.email} · <span className="uppercase">{profile.visaTarget}</span></p>
          </div>
          <Badge className="capitalize bg-[#1E2D6B]/10 text-[#1E2D6B] border-0 px-3 py-1">
            {profile.accessLevel?.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab ? "border-[#1E2D6B] text-[#1E2D6B]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300",
              )}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && <OverviewTab userId={user_id} data={profileData} onReload={loadProfile} />}
        {activeTab === "Evidence" && <EvidenceTab userId={user_id} />}
        {activeTab === "Excellence Lab" && <ExcellenceLabTab userId={user_id} />}
        {activeTab === "Petition Workspace" && <PetitionWorkspaceTab userId={user_id} />}
        {activeTab === "Petition Assessment" && <PetitionAssessmentTab userId={user_id} />}
        {activeTab === "Exhibits" && <ExhibitsTab userId={user_id} profileData={profileData} />}
        {activeTab === "Documents" && <DocumentsTab userId={user_id} />}
        {activeTab === "Drive Folders" && <DriveFoldersTab userId={user_id} />}
      </main>
    </div>
  );
}
