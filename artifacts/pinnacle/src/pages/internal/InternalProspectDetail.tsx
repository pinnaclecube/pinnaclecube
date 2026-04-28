import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, BookOpen, Trophy, Briefcase, Mail, ExternalLink, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  in_contact: "bg-blue-100 text-blue-700",
  qualified: "bg-green-100 text-green-700",
  not_qualified: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

export default function InternalProspectDetail() {
  const { id } = useParams() as { id: string };
  const [prospect, setProspect] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await staffFetch(`/admin/prospects/${id}`);
      if (r.ok) {
        const d = await r.json();
        setProspect(d.prospect);
        setEditForm(d.prospect);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await staffFetch(`/admin/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      if (r.ok) {
        const d = await r.json();
        setProspect(d.prospect);
        setEditing(false);
      }
    } finally { setSaving(false); }
  };

  const sendInvite = async () => {
    setInviting(true);
    try {
      const r = await staffFetch(`/admin/prospects/${id}/invite`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setInviteResult(d.message ?? "Invite sent!");
        await load();
      } else {
        setInviteResult("Failed to send invite.");
      }
    } finally { setInviting(false); setShowInviteConfirm(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />)}</div>
        </main>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
          <Link href="/internal/prospects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> All Prospects
          </Link>
          <p className="text-muted-foreground">Prospect not found.</p>
        </main>
      </div>
    );
  }

  const alreadyInvited = prospect.registrationStatus !== "not_invited";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        <Link href="/internal/prospects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Prospects
        </Link>

        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">{prospect.fullName}</h1>
            <p className="text-muted-foreground text-sm">{prospect.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[prospect.status ?? "new"] ?? "bg-gray-100 text-gray-600")}>
                {(prospect.status ?? "new").replace(/_/g, " ")}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {(prospect.registrationStatus ?? "not_invited").replace(/_/g, " ")}
              </Badge>
              {prospect.publicationsSignal && <span className="flex items-center gap-1 text-xs text-blue-600"><BookOpen className="w-3 h-3" />Publications</span>}
              {prospect.awardsSignal && <span className="flex items-center gap-1 text-xs text-yellow-600"><Trophy className="w-3 h-3" />Awards</span>}
              {prospect.leadershipSignal && <span className="flex items-center gap-1 text-xs text-green-600"><Briefcase className="w-3 h-3" />Leadership</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(prospect); }}>Cancel</Button>
                <Button size="sm" onClick={saveEdit} disabled={saving} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </>
            )}
            <Button size="sm" className={cn(alreadyInvited ? "bg-indigo-100 hover:bg-indigo-200 text-[#1E2D6B] border border-indigo-200" : "bg-[#1E2D6B] hover:bg-[#3D4FA8]")}
              onClick={() => setShowInviteConfirm(true)}>
              {alreadyInvited ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Re-invite</> : <><Mail className="w-3.5 h-3.5 mr-1.5" />Invite Client</>}
            </Button>
          </div>
        </div>

        {inviteResult && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
            {inviteResult}
          </div>
        )}

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Profile Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["fullName", "Full Name"],
                    ["email", "Email"],
                    ["currentRole", "Current Role"],
                    ["fieldOfWork", "Field of Work"],
                    ["yearsOfExperience", "Years of Experience"],
                    ["linkedinUrl", "LinkedIn URL"],
                    ["sourceType", "Source"],
                  ] as [string, string][]).map(([field, label]) => (
                    <div key={field} className={field === "linkedinUrl" ? "col-span-2" : ""}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                      <Input value={editForm[field] ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                    <Select value={editForm.status ?? "new"} onValueChange={(v) => setEditForm((p: any) => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["new", "in_contact", "qualified", "not_qualified", "converted"].map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-4">
                    {(["publicationsSignal", "awardsSignal", "leadershipSignal"] as const).map((field) => (
                      <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={editForm[field] ?? false}
                          onCheckedChange={(v) => setEditForm((p: any) => ({ ...p, [field]: !!v }))} />
                        {field.replace("Signal", "").replace(/([A-Z])/g, " $1")}
                      </label>
                    ))}
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Internal Notes</label>
                    <Textarea value={editForm.internalNotes ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, internalNotes: e.target.value }))} className="min-h-[80px]" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ["Current Role", prospect.currentRole],
                    ["Field", prospect.fieldOfWork],
                    ["Experience", prospect.yearsOfExperience],
                    ["Source", prospect.sourceType],
                  ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-medium capitalize">{v}</p>
                    </div>
                  ))}
                  {prospect.linkedinUrl && (
                    <div className="col-span-2">
                      <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#1E2D6B] hover:underline">
                        <ExternalLink className="w-3 h-3" /> LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {prospect.internalNotes && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Internal Notes</p>
                      <p className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2">{prospect.internalNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{new Date(prospect.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registration Status</span>
                  <span className="font-medium capitalize">{(prospect.registrationStatus ?? "not_invited").replace(/_/g, " ")}</span>
                </div>
                {prospect.linkedProfileId && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Linked Case</span>
                    <Link href={`/internal/case/${prospect.linkedProfileId}`} className="text-[#1E2D6B] hover:underline font-medium text-xs">
                      View Case #{prospect.linkedProfileId}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showInviteConfirm} onOpenChange={setShowInviteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alreadyInvited ? `Re-invite ${prospect.fullName}` : `Invite ${prospect.fullName}`}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {alreadyInvited
              ? <>A new registration invite will be sent to <strong>{prospect.email}</strong>. Any previously sent link will still work.</>
              : <>Send a registration invite to <strong>{prospect.email}</strong>. They'll receive a link to create their Pinnacle³ account.</>
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteConfirm(false)}>Cancel</Button>
            <Button onClick={sendInvite} disabled={inviting} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {inviting ? "Sending…" : alreadyInvited ? "Re-send Invite" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
