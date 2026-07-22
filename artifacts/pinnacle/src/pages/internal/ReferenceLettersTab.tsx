/**
 * ReferenceLettersTab.tsx — Pinnacle³ (staff case detail)
 *
 * Staff view + full add/edit/delete of a case's referees. Resolves the case id
 * from the profile via /internal/petition/setup/:userId, then uses the same
 * dual-auth referee endpoints as the client (with X-Staff-Token). Reuses the
 * shared RefereeForm inside a modal.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Loader2, UserPlus, ChevronRight, Trash2, Pencil, ExternalLink,
  ShieldCheck, Users, Mail, Shield, Lock, Unlock, FileUp, Send, FileText,
  FileSpreadsheet,
} from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RefereeForm, type Referee, type LookupItem } from "@/components/referees/RefereeForm";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function LetterChip({ referee }: { referee: Referee }) {
  if (referee.isLocked) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-green-300 text-green-700 bg-green-50">
        <Lock className="w-2.5 h-2.5" /> Confirmed &amp; locked
      </Badge>
    );
  }
  if (referee.activeLetter?.status === "pending_review") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
        <FileText className="w-2.5 h-2.5" /> Pending client review
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 border-gray-200 text-gray-400">
      No letter
    </Badge>
  );
}

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

function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// ─── Referee row (summary + expandable detail) ───────────────────────────────────

function RefereeRow({
  referee, onEdit, onDelete, onSaved, onRequestUnlock,
}: {
  referee: Referee;
  onEdit: (r: Referee) => void;
  onDelete: (r: Referee) => void;
  onSaved: (r: Referee) => void;
  onRequestUnlock: (r: Referee) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "resend">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const locked = !!referee.isLocked;
  const letter = referee.activeLetter ?? null;

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && file.type !== DOCX_MIME) {
      toast({ title: "Letter must be a PDF or DOCX", variant: "destructive" });
      return;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await staffFetch(`/referees/${referee.id}/letter`, { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      toast({ title: "Reference letter uploaded — client notified to review" });
      if (d.warning) toast({ title: d.warning, variant: "destructive" });
      onSaved({ ...referee, activeLetter: d.letter });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleResend() {
    setBusy("resend");
    try {
      const r = await staffFetch(`/referees/${referee.id}/letter/resend-email`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Resend failed");
      toast({ title: d.warning ?? "Review email resent", variant: d.warning ? "destructive" : undefined });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Resend failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <ChevronRight className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform", open && "rotate-90")} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{referee.fullName}</p>
              {referee.createdBy === "staff" && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                  <Shield className="w-2.5 h-2.5" /> Added by staff
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {[referee.title, referee.organization, referee.country].filter(Boolean).join(" · ")}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <LetterChip referee={referee} />
          <Badge variant="outline" className={cn(
            "text-[10px] gap-1",
            referee.willingnessConfirmed ? "border-green-300 text-green-700 bg-green-50" : "border-gray-200 text-gray-500",
          )}>
            <ShieldCheck className="w-2.5 h-2.5" />
            {referee.willingnessConfirmed ? "Willing" : "Not confirmed"}
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 border-indigo-200 text-[#3D4FA8] bg-indigo-50">
            <Users className="w-2.5 h-2.5" />
            {referee.workedTogether ? "Worked together" : "Independent"}
          </Badge>
          {locked ? (
            <button onClick={() => onRequestUnlock(referee)}
              className="p-1 text-amber-500 hover:text-amber-700" title="Unlock referee">
              <Unlock className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button onClick={() => onEdit(referee)} className="p-1 text-gray-400 hover:text-[#1E2D6B]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDelete(referee)} className="p-1 text-gray-300 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t px-4 py-3 space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            <Detail label="Email" value={referee.email} />
            <Detail label="Phone" value={referee.phone} />
            <Detail label="Country" value={referee.country} />
            <Detail label="Degree" value={referee.degreeName} />
            <Detail label="Field" value={referee.fieldOfExpertise} />
            <Detail label="Profile" value={referee.profileUrl} isLink />
          </div>

          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Contributions</p>
            {referee.contributions.length === 0 ? (
              <p className="text-xs text-muted-foreground">None selected.</p>
            ) : (
              <ul className="space-y-1.5">
                {referee.contributions.map((c) => (
                  <li key={c.contributionTypeId} className="text-xs">
                    <span className="font-medium">{c.contributionTypeName ?? `#${c.contributionTypeId}`}:</span>{" "}
                    <span className="text-muted-foreground">{c.details}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {referee.cvDriveFileId && (
            <a href={driveFileUrl(referee.cvDriveFileId)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E2D6B] hover:text-[#3D4FA8]">
              <ExternalLink className="w-3.5 h-3.5" /> Open CV in Drive
            </a>
          )}

          {/* Reference letter */}
          <div className="pt-2 border-t">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Reference letter</p>
            {letter ? (
              <div className="flex items-center gap-3 flex-wrap">
                <a href={letter.driveUrl ?? driveFileUrl(letter.driveFileId)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E2D6B] hover:text-[#3D4FA8]">
                  <ExternalLink className="w-3.5 h-3.5" /> View letter in Drive
                </a>
                {letter.version > 1 && <span className="text-[11px] text-muted-foreground">v{letter.version}</span>}
                <span className="text-[11px] text-muted-foreground">
                  {locked ? "Confirmed & locked" : "Awaiting client confirmation"}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No letter uploaded yet.</p>
            )}

            {locked ? (
              <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-2">
                <Lock className="w-3 h-3" /> Locked — unlock to replace the letter or edit the referee.
              </p>
            ) : (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <label className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded border px-2 py-1 border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5",
                  busy === "upload" && "opacity-60 pointer-events-none",
                )}>
                  {busy === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  {letter ? "Replace letter" : "Upload letter"} (PDF/DOCX)
                  <input ref={fileRef} type="file" accept="application/pdf,.docx" className="hidden"
                    onChange={(e) => void handleUpload(e.target.files?.[0])} />
                </label>
                {letter?.status === "pending_review" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy !== null}
                    onClick={() => void handleResend()}>
                    {busy === "resend" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Resend review email
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      {value ? (
        isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1E2D6B] hover:underline truncate block">{value}</a>
        ) : (
          <p className="text-xs truncate">{value}</p>
        )
      ) : (
        <p className="text-xs text-gray-300">—</p>
      )}
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────────

export function ReferenceLettersTab({ userId }: { userId: string }) {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degreeTypes, setDegreeTypes] = useState<LookupItem[]>([]);
  const [contributionTypes, setContributionTypes] = useState<LookupItem[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [formModal, setFormModal] = useState<{ open: boolean; referee: Referee | null }>({ open: false, referee: null });
  const [deleteTarget, setDeleteTarget] = useState<Referee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<Referee | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const setupRes = await staffFetch(`/internal/petition/setup/${userId}`);
      const setupData = (await setupRes.json()) as { cases?: { setup?: { id: number } }[] };
      const resolvedCaseId = setupData.cases?.[0]?.setup?.id ?? null;
      if (!resolvedCaseId) {
        setError("No case has been set up for this client yet.");
        return;
      }
      setCaseId(resolvedCaseId);

      const [dt, ct, refs] = await Promise.all([
        staffFetch("/lookups/degree-types").then((r) => r.json()),
        staffFetch("/lookups/contribution-types").then((r) => r.json()),
        staffFetch(`/cases/${resolvedCaseId}/referees`).then((r) => r.json()),
      ]);
      setDegreeTypes(dt.degreeTypes ?? []);
      setContributionTypes(ct.contributionTypes ?? []);
      setReferees(refs.referees ?? []);
    } catch {
      setError("Something went wrong loading referees. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const onSaved = (saved: Referee) => {
    setReferees((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
    });
    setFormModal({ open: false, referee: null });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await staffFetch(`/referees/${deleteTarget.id}`, { method: "DELETE" });
      if (r.ok) setReferees((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const confirmUnlock = async () => {
    if (!unlockTarget) return;
    setUnlocking(true);
    try {
      const r = await staffFetch(`/referees/${unlockTarget.id}/unlock`, { method: "POST" });
      const d = await r.json();
      if (r.ok && d.referee) onSaved(d.referee);
    } finally {
      setUnlocking(false);
      setUnlockTarget(null);
    }
  };

  const handleExport = async () => {
    if (caseId === null) return;
    setExporting(true);
    try {
      const r = await staffFetch(`/cases/${caseId}/referees/export`);
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Export failed");
      }
      const blob = await r.blob();
      // Prefer the server's filename from Content-Disposition; fall back sensibly.
      const cd = r.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(cd);
      const fileName = match?.[1] ?? `Referees - Case ${caseId}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" /></div>;
  }
  if (error) {
    return <div className="text-sm text-muted-foreground py-12 text-center">{error}</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" /> Reference Letters
        </h3>
        {caseId !== null && (
          <div className="flex items-center gap-2">
            {referees.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5"
                onClick={() => void handleExport()} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Export to Excel
              </Button>
            )}
            <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
              onClick={() => setFormModal({ open: true, referee: null })}>
              <UserPlus className="w-4 h-4" /> Add Referee
            </Button>
          </div>
        )}
      </div>

      {referees.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-white">
          <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No referees added yet.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5"
            onClick={() => setFormModal({ open: true, referee: null })}>
            <UserPlus className="w-4 h-4" /> Add Referee
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {referees.map((r) => (
            <RefereeRow key={r.id} referee={r}
              onEdit={(ref) => setFormModal({ open: true, referee: ref })}
              onDelete={setDeleteTarget}
              onSaved={onSaved}
              onRequestUnlock={setUnlockTarget} />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Dialog open={formModal.open} onOpenChange={(o) => setFormModal((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formModal.referee ? "Edit referee" : "Add referee"}</DialogTitle>
          </DialogHeader>
          {caseId !== null && (
            <RefereeForm
              caseId={caseId}
              fetchFn={staffFetch}
              referee={formModal.referee}
              degreeTypes={degreeTypes}
              contributionTypes={contributionTypes}
              onSaved={onSaved}
              onCancel={() => setFormModal({ open: false, referee: null })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this referee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.fullName ? `"${deleteTarget.fullName}"` : "This referee"} and their
              contributions will be permanently removed. This cannot be undone.
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

      {/* Unlock confirm */}
      <AlertDialog open={!!unlockTarget} onOpenChange={(o) => !o && setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this referee?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking allows edits and will require the client to re-confirm the reference
              letter. The letter's status returns to "pending client review." Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmUnlock(); }}
              disabled={unlocking} className="bg-amber-600 hover:bg-amber-700">
              {unlocking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
