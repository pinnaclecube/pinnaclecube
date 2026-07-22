/**
 * reference-letters.tsx — Pinnacle³
 *
 * Client "Reference Letters" section — referee intake + letter review.
 * Resolves the client's case via GET /cases/me, then shows repeatable referee
 * cards (each saved independently) + an "Add Referee" action.
 *
 * Step 2: once staff upload a reference letter it appears here for the client to
 * download, review in detail, and confirm. Confirming locks the referee + letter.
 */

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Loader2, AlertCircle, UserPlus, ChevronRight, Trash2, Mail, ShieldCheck, Users,
  Download, Lock, FileText, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefereeForm, type Referee, type LookupItem } from "@/components/referees/RefereeForm";

const TOKEN_KEY = "pinnacle_token";

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

// ─── Header status chip ──────────────────────────────────────────────────────────

function LetterStatusChip({ referee }: { referee: Referee }) {
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
        <FileText className="w-2.5 h-2.5" /> Letter ready to review
      </Badge>
    );
  }
  return null;
}

// ─── Letter review / download / confirm panel ────────────────────────────────────

function LetterReviewPanel({
  referee, onSaved,
}: {
  referee: Referee;
  onSaved: (r: Referee) => void;
}) {
  const { toast } = useToast();
  const letter = referee.activeLetter ?? null;
  const [downloading, setDownloading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!letter) return null;

  const locked = !!referee.isLocked;
  const pending = letter.status === "pending_review";

  async function handleDownload() {
    setDownloading(true);
    try {
      const r = await clientFetch(`/referees/${referee.id}/letter/download`);
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Download failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = letter?.fileName ?? `${referee.fullName} — Reference Letter`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const r = await clientFetch(`/referees/${referee.id}/letter/confirm`, { method: "POST" });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Confirmation failed");
      }
      const data = (await r.json()) as { referee: Referee };
      toast({ title: "Reference letter confirmed", description: "This referee is now locked." });
      onSaved(data.referee);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Confirmation failed", variant: "destructive" });
    } finally {
      setConfirming(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className={cn(
      "rounded-lg border p-4 mb-4",
      locked ? "border-green-200 bg-green-50/60" : "border-amber-200 bg-amber-50/60",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          locked ? "bg-green-100" : "bg-amber-100",
        )}>
          {locked ? <CheckCircle2 className="w-5 h-5 text-green-700" /> : <FileText className="w-5 h-5 text-amber-700" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {locked ? "Reference letter confirmed & locked" : "Your reference letter is ready to review"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locked
              ? "You confirmed this letter. The referee and letter are locked — contact your advisor if a change is needed."
              : "Download and review the letter carefully — check every fact, date, title, and the spelling of all names. Once you confirm, this referee and letter will be locked."}
            {letter.version > 1 && <span className="ml-1 text-gray-400">(version {letter.version})</span>}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download letter
            </Button>
          </div>

          {pending && !locked && (
            <div className="mt-4 border-t border-amber-200 pt-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={acknowledged}
                  onCheckedChange={(c) => setAcknowledged(c === true)} className="mt-0.5" />
                <span className="text-xs text-gray-700 leading-relaxed">
                  I have downloaded and reviewed this reference letter in detail. All facts, dates, titles,
                  and names are accurate. I understand that confirming will <strong>lock</strong> this referee
                  and letter, and no further edits can be made.
                </span>
              </label>
              <div className="flex justify-end mt-3">
                <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
                  disabled={!acknowledged || confirming}
                  onClick={() => setConfirmOpen(true)}>
                  <Lock className="w-3.5 h-3.5" /> Confirm &amp; lock
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this reference letter?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirming locks <strong>{referee.fullName || "this referee"}</strong> and their reference
              letter. No further edits can be made unless your advisor unlocks it. This action notifies
              your advisory team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleConfirm(); }}
              disabled={confirming} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Confirm &amp; lock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Referee card (collapsible: summary → edit form) ─────────────────────────────

function RefereeCard({
  referee, caseId, degreeTypes, contributionTypes, onSaved, onRequestDelete,
}: {
  referee: Referee;
  caseId: number;
  degreeTypes: LookupItem[];
  contributionTypes: LookupItem[];
  onSaved: (r: Referee) => void;
  onRequestDelete: (r: Referee) => void;
}) {
  const [open, setOpen] = useState(false);
  const locked = !!referee.isLocked;

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <ChevronRight className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform", open && "rotate-90")} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{referee.fullName || "New referee"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[referee.title, referee.organization].filter(Boolean).join(" · ")}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <LetterStatusChip referee={referee} />
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
          {!locked && (
            <button onClick={() => onRequestDelete(referee)}
              className="p-1 text-gray-300 hover:text-red-600 transition-colors" title="Delete referee">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t px-4 py-4">
          <LetterReviewPanel referee={referee} onSaved={onSaved} />
          <RefereeForm caseId={caseId} fetchFn={clientFetch} referee={referee}
            degreeTypes={degreeTypes} contributionTypes={contributionTypes}
            onSaved={onSaved} readOnly={locked} />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function ReferenceLetters() {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degreeTypes, setDegreeTypes] = useState<LookupItem[]>([]);
  const [contributionTypes, setContributionTypes] = useState<LookupItem[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [drafts, setDrafts] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Referee | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      const [dt, ct, refs] = await Promise.all([
        clientFetch("/lookups/degree-types").then((r) => r.json()),
        clientFetch("/lookups/contribution-types").then((r) => r.json()),
        clientFetch(`/cases/${me.caseId}/referees`).then((r) => r.json()),
      ]);
      setDegreeTypes(dt.degreeTypes ?? []);
      setContributionTypes(ct.contributionTypes ?? []);
      setReferees(refs.referees ?? []);
    } catch {
      setError("Something went wrong loading this page. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addDraft = () => setDrafts((d) => [...d, Date.now()]);
  const removeDraft = (key: number) => setDrafts((d) => d.filter((k) => k !== key));

  const onSavedNew = (key: number) => (created: Referee) => {
    setReferees((prev) => [created, ...prev]);
    removeDraft(key);
  };
  const onSavedExisting = (updated: Referee) =>
    setReferees((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await clientFetch(`/referees/${deleteTarget.id}`, { method: "DELETE" });
      if (r.ok) setReferees((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/8 flex items-center justify-center shrink-0 mt-0.5">
            <Mail className="w-5 h-5 text-[#1E2D6B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reference Letters</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Add the referees who can speak to your work. Each referee is saved on its own.
            </p>
          </div>
        </div>
        {!loading && !error && caseId !== null && (
          <Button onClick={addDraft} className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" /> Add Referee
          </Button>
        )}
      </div>

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
      ) : caseId !== null ? (
        <div className="space-y-3 max-w-3xl">
          {/* New draft cards */}
          {drafts.map((key) => (
            <div key={`draft-${key}`} className="rounded-lg border-2 border-dashed border-[#1E2D6B]/25 bg-white px-4 py-4">
              <p className="text-xs font-semibold text-[#1E2D6B] uppercase tracking-wide mb-3">New referee</p>
              <RefereeForm caseId={caseId} fetchFn={clientFetch} referee={null}
                degreeTypes={degreeTypes} contributionTypes={contributionTypes}
                onSaved={onSavedNew(key)} onCancel={() => removeDraft(key)} />
            </div>
          ))}

          {/* Saved referees */}
          {referees.map((r) => (
            <RefereeCard key={r.id} referee={r} caseId={caseId}
              degreeTypes={degreeTypes} contributionTypes={contributionTypes}
              onSaved={onSavedExisting} onRequestDelete={setDeleteTarget} />
          ))}

          {referees.length === 0 && drafts.length === 0 && (
            <div className="text-center py-16 border rounded-lg bg-white">
              <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No referees added yet.</p>
              <Button onClick={addDraft} variant="outline" size="sm" className="mt-3 gap-1.5">
                <UserPlus className="w-4 h-4" /> Add your first referee
              </Button>
            </div>
          )}
        </div>
      ) : null}

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
    </AppLayout>
  );
}
