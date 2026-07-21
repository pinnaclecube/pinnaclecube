/**
 * ReferenceLettersTab.tsx — Pinnacle³ (staff case detail)
 *
 * Staff view + full add/edit/delete of a case's referees. Resolves the case id
 * from the profile via /internal/petition/setup/:userId, then uses the same
 * dual-auth referee endpoints as the client (with X-Staff-Token). Reuses the
 * shared RefereeForm inside a modal.
 */

import { useState, useEffect, useCallback } from "react";
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
  ShieldCheck, Users, Mail, Shield,
} from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { cn } from "@/lib/utils";
import { RefereeForm, type Referee, type LookupItem } from "@/components/referees/RefereeForm";

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
  referee, onEdit, onDelete,
}: {
  referee: Referee;
  onEdit: (r: Referee) => void;
  onDelete: (r: Referee) => void;
}) {
  const [open, setOpen] = useState(false);

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
          <button onClick={() => onEdit(referee)} className="p-1 text-gray-400 hover:text-[#1E2D6B]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(referee)} className="p-1 text-gray-300 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
            onClick={() => setFormModal({ open: true, referee: null })}>
            <UserPlus className="w-4 h-4" /> Add Referee
          </Button>
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
              onDelete={setDeleteTarget} />
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
    </div>
  );
}
