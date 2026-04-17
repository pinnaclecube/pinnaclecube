import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { AIBadge } from "@/components/disclaimers/AIBadge";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function InternalEvidenceDetail() {
  const { user_id, evidence_id } = useParams() as { user_id: string; evidence_id: string };
  const [evidenceGroups, setEvidenceGroups] = useState<any[]>([]);
  const [item, setItem] = useState<any>(null);
  const [criteriaOptions, setCriteriaOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState("");
  const [reclassifyTarget, setReclassifyTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const eid = parseInt(evidence_id, 10);

  useEffect(() => {
    Promise.all([
      staffFetch(`/admin/profiles/${user_id}/evidence`).then((r) => r.json()),
      staffFetch("/criteria").then((r) => r.json()),
    ]).then(([ev, cr]) => {
      const allItems = (ev.evidence ?? []).flatMap((g: any) => g.items);
      const found = allItems.find((i: any) => i.id === eid);
      setItem(found ?? null);
      setEvidenceGroups(ev.evidence ?? []);
      setCriteriaOptions(cr.criteria ?? []);
      if (found?.primaryCriteriaId) setReclassifyTarget(found.primaryCriteriaId);
      setLoading(false);
    });
  }, [user_id, eid]);

  const saveNote = async () => {
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      await staffFetch(`/admin/profiles/${user_id}/evidence/${eid}`, { method: "PATCH", body: JSON.stringify({ note: noteInput }) });
      setNoteInput("");
      const r = await staffFetch(`/admin/profiles/${user_id}/evidence`);
      const d = await r.json();
      const allItems = (d.evidence ?? []).flatMap((g: any) => g.items);
      setItem(allItems.find((i: any) => i.id === eid) ?? null);
    } finally { setSaving(false); }
  };

  const reclassify = async () => {
    if (!reclassifyTarget) return;
    setSaving(true);
    try {
      await staffFetch(`/admin/profiles/${user_id}/evidence/${eid}`, { method: "PATCH", body: JSON.stringify({ primaryCriteriaId: reclassifyTarget }) });
    } finally { setSaving(false); }
  };

  const regenerateAI = async () => {
    setSaving(true);
    try {
      await staffFetch(`/admin/profiles/${user_id}/evidence/${eid}/regenerate-ai`, { method: "POST" });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        <Link href={`/internal/case/${user_id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Case
        </Link>

        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : !item ? (
          <p className="text-muted-foreground">Evidence item not found.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">{item.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline">{item.evidenceType}</Badge>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                  item.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                  {item.status}
                </span>
                {item.primaryCriteriaId && <Badge className="text-xs">{item.primaryCriteriaId}</Badge>}
              </div>
            </div>

            {item.description && (
              <Card>
                <CardContent className="p-4 text-sm">{item.description}</CardContent>
              </Card>
            )}

            {item.aiSummary && !item.aiSummaryIgnored && (
              <AIOutputBanner variant="summary">
                <div className="flex items-start gap-2">
                  <AIBadge />
                  <p className="text-sm">{item.aiSummary}</p>
                </div>
              </AIOutputBanner>
            )}

            <div className="grid grid-cols-2 gap-3">
              {item.driveFileUrl && (
                <a href={item.driveFileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" /> View in Drive
                  </Button>
                </a>
              )}
              <Button variant="outline" onClick={regenerateAI} disabled={saving}>
                <RefreshCw className={cn("w-4 h-4 mr-2", saving && "animate-spin")} /> Regenerate AI Summary
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Reclassify Criteria</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-2">
                <Select value={reclassifyTarget} onValueChange={setReclassifyTarget}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select new criteria" /></SelectTrigger>
                  <SelectContent>
                    {criteriaOptions.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.id} — {c.name ?? c.criteriaName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={reclassify} disabled={saving || !reclassifyTarget} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Apply</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Internal Staff Notes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {item.internalNotes?.length > 0 ? item.internalNotes.map((n: any) => (
                  <div key={n.id} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm">{n.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground italic">No notes yet.</p>}
                <div className="flex items-center gap-2">
                  <Input placeholder="Add note…" value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveNote()} />
                  <Button variant="outline" onClick={saveNote} disabled={saving || !noteInput.trim()}>Add</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
