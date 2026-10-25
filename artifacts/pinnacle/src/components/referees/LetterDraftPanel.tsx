/**
 * LetterDraftPanel.tsx — Pinnacle³
 *
 * Step 4 — AI reference-letter draft panel. Shared by the client portal and the
 * staff portal (each passes its own fetchFn + flags). Clients generate and request
 * changes (capped at 3); staff additionally edit, view version history, and
 * finalize. Read-only when the referee is locked.
 *
 * GET  /referees/:id/letter-draft
 * POST /referees/:id/letter-draft/generate
 * PUT  /referees/:id/letter-draft            (staff)
 * POST /referees/:id/letter-draft/finalize   (staff)
 */

import { useState, useEffect, useCallback, Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Sparkles, AlertCircle, FileText, Lock, MessageSquarePlus, Pencil,
  CheckCircle2, Send, History, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

interface Draft {
  id: number; version: number; content: string;
  generatedBy: string; feedbackProvided: string | null;
  wasManuallyEdited: boolean; status: "draft" | "finalized" | "superseded";
  createdAt: string;
}
interface Eligibility { ok: boolean; reasons: string[] }

// ─── Minimal markdown renderer (paragraphs, bold/italic, bullets) ────────────────

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined || m[4] !== undefined) nodes.push(<strong key={`${keyBase}-${i}`}>{m[2] ?? m[4]}</strong>);
    else nodes.push(<em key={`${keyBase}-${i}`}>{m[3] ?? m[5]}</em>);
    last = re.lastIndex; i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function RenderedLetter({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="text-sm text-gray-800 leading-relaxed space-y-3">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^[-*]\s+/, ""), `${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        const h = lines.length === 1 ? /^#{1,3}\s+(.*)$/.exec(lines[0]) : null;
        if (h) return <p key={bi} className="font-semibold">{inline(h[1], `h-${bi}`)}</p>;
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function LetterDraftPanel({
  refereeId, fetchFn, readOnly = false, staff = false, onFinalized,
}: {
  refereeId: number;
  fetchFn: FetchFn;
  readOnly?: boolean;
  staff?: boolean;
  onFinalized?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility>({ ok: false, reasons: [] });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [cap, setCap] = useState(3);
  const [history, setHistory] = useState<Draft[]>([]);

  const [generating, setGenerating] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [viewing, setViewing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchFn(`/referees/${refereeId}/letter-draft`).then((r) => r.json());
      setDraft(d.draft ?? null);
      setEligibility(d.eligibility ?? { ok: false, reasons: [] });
      if (staff) setHistory(d.history ?? []);
      else { setRemaining(d.remainingClientGenerations ?? null); setCap(d.generationCap ?? 3); }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [refereeId, fetchFn, staff]);

  useEffect(() => { void load(); }, [load]);

  async function generate(feedbackText?: string) {
    setGenerating(true);
    try {
      const r = await fetchFn(`/referees/${refereeId}/letter-draft/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackText ? { feedback: feedbackText } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.reasons) toast({ title: d.reasons.join(" "), variant: "destructive" });
        else toast({ title: d.error ?? "Generation failed", variant: "destructive" });
        return;
      }
      setFeedbackOpen(false); setFeedback("");
      toast({ title: "Draft generated" });
      await load();
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const r = await fetchFn(`/referees/${refereeId}/letter-draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      });
      if (!r.ok) throw new Error("Save failed");
      setEditing(false);
      toast({ title: "Draft updated" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    try {
      const r = await fetchFn(`/referees/${refereeId}/letter-draft/finalize`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.reasons) toast({ title: d.reasons.join(" "), variant: "destructive" });
        else toast({ title: d.error ?? "Finalize failed", variant: "destructive" });
        return;
      }
      toast({ title: "Letter finalized — client notified to review" });
      if (d.warning) toast({ title: d.warning, variant: "destructive" });
      onFinalized?.();
      await load();
    } catch {
      toast({ title: "Finalize failed", variant: "destructive" });
    } finally {
      setFinalizing(false);
      setFinalizeOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border mt-4 p-4 flex items-center justify-center h-20">
        <Loader2 className="w-5 h-5 animate-spin text-[#1E2D6B]" />
      </div>
    );
  }

  const atCap = !staff && remaining !== null && remaining <= 0;
  const canGenerate = eligibility.ok && !readOnly && !generating && (staff || !atCap);
  const shown = viewing ?? draft;

  return (
    <div className="rounded-lg border mt-4">
      <div className="px-4 py-3 border-b bg-gray-50/60 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#1E2D6B]" />
        <h3 className="text-sm font-semibold">AI reference letter draft</h3>
        {draft && (
          <Badge variant="outline" className={cn(
            "text-[10px] gap-1",
            draft.status === "finalized" ? "border-green-300 text-green-700 bg-green-50" : "border-[#1E2D6B]/20 text-[#1E2D6B] bg-[#1E2D6B]/5",
          )}>
            <FileText className="w-2.5 h-2.5" />
            {draft.status === "finalized" ? "Finalized" : `Draft v${draft.version}`}
          </Badge>
        )}
        {readOnly && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-600">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Ineligible → reasons */}
        {!eligibility.ok && !draft && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Not ready to generate yet:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {eligibility.reasons.map((r, i) => <li key={i} className="text-xs text-amber-700">{r}</li>)}
            </ul>
          </div>
        )}

        {/* No draft yet, eligible → generate */}
        {!draft && eligibility.ok && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Generate a first draft from this referee's mapped projects and evidence.
            </p>
            <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={!canGenerate}
              onClick={() => void generate()}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Reference Letter
            </Button>
          </div>
        )}

        {/* Generating overlay note */}
        {generating && draft && (
          <p className="text-xs text-[#1E2D6B] flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating a new draft… this can take up to a minute.
          </p>
        )}

        {/* Draft viewer */}
        {shown && (
          <>
            {staff && history.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <History className="w-3 h-3 text-muted-foreground" />
                {history.map((h) => (
                  <button key={h.id} onClick={() => setViewing(h.id === draft?.id ? null : h)}
                    className={cn("px-1.5 py-0.5 rounded border",
                      (viewing?.id ?? draft?.id) === h.id ? "border-[#1E2D6B] text-[#1E2D6B] bg-[#1E2D6B]/5" : "border-gray-200 text-muted-foreground")}>
                    v{h.version}{h.status === "finalized" ? " ✓" : h.status === "superseded" ? "" : ""}
                  </button>
                ))}
                {viewing && <span className="text-amber-600">viewing v{viewing.version} (read-only)</span>}
              </div>
            )}

            {editing ? (
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                className="min-h-[320px] text-sm font-mono" />
            ) : (
              <div className="rounded-md border bg-white p-4 max-h-96 overflow-y-auto">
                <RenderedLetter content={shown.content} />
              </div>
            )}

            {(shown.wasManuallyEdited || shown.feedbackProvided) && (
              <p className="text-[11px] text-muted-foreground">
                {shown.wasManuallyEdited && "Manually edited by staff. "}
                {shown.feedbackProvided && <>Last change request: “{shown.feedbackProvided}”</>}
              </p>
            )}
          </>
        )}

        {/* ── Client actions ───────────────────────────────────────────────── */}
        {!staff && draft && draft.status !== "finalized" && !readOnly && (
          <div className="space-y-2 pt-1">
            {atCap ? (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> You've used all {cap} change requests. Contact our team for further changes.
              </p>
            ) : feedbackOpen ? (
              <div className="space-y-2">
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What should change? (e.g. emphasize the compliance work, correct my title)"
                  className="min-h-[72px] text-sm" />
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[11px] text-muted-foreground mr-auto">{remaining} of {cap} change requests remaining</span>
                  <Button variant="ghost" size="sm" onClick={() => { setFeedbackOpen(false); setFeedback(""); }} disabled={generating}>Cancel</Button>
                  <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
                    disabled={!feedback.trim() || generating} onClick={() => void generate(feedback)}>
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
                    Submit & regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFeedbackOpen(true)} disabled={generating}>
                <MessageSquarePlus className="w-3.5 h-3.5" /> Request changes ({remaining} of {cap} left)
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              The Pinnacle³ team reviews and finalizes this letter before it is sent to you for confirmation.
            </p>
          </div>
        )}

        {/* ── Staff actions ────────────────────────────────────────────────── */}
        {staff && !readOnly && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {draft && draft.status !== "finalized" && (
              editing ? (
                <>
                  <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={saving} onClick={() => void saveEdit()}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />} Save edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!!viewing}
                  onClick={() => { setEditText(draft.content); setEditing(true); }}>
                  <Pencil className="w-3.5 h-3.5" /> Edit draft
                </Button>
              )
            )}
            {draft && !editing && (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!canGenerate}
                onClick={() => setFeedbackOpen((v) => !v)}>
                <Sparkles className="w-3.5 h-3.5" /> Regenerate
              </Button>
            )}
            {draft && draft.status !== "finalized" && !editing && (
              <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1.5 ml-auto"
                disabled={!eligibility.ok || generating} onClick={() => setFinalizeOpen(true)}>
                <Send className="w-3.5 h-3.5" /> Finalize & Send for Client Review
              </Button>
            )}
            {draft?.status === "finalized" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-700 ml-auto">
                <CheckCircle2 className="w-4 h-4" /> Finalized — in the client review flow
              </span>
            )}
          </div>
        )}

        {/* Staff regenerate-with-instructions textarea */}
        {staff && feedbackOpen && !readOnly && (
          <div className="space-y-2">
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional instructions for the regeneration" className="min-h-[64px] text-sm" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setFeedbackOpen(false); setFeedback(""); }} disabled={generating}>Cancel</Button>
              <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5" disabled={generating} onClick={() => void generate(feedback || undefined)}>
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Finalize confirm (staff) */}
      <AlertDialog open={finalizeOpen} onOpenChange={(o) => !o && setFinalizeOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize and send for client review?</AlertDialogTitle>
            <AlertDialogDescription>
              This renders the current draft to a DOCX, uploads it to the case's Drive folder, and emails
              the client to review and confirm. The referee locks once the client confirms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void finalize(); }}
              disabled={finalizing} className="bg-green-700 hover:bg-green-800">
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Finalize & Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
