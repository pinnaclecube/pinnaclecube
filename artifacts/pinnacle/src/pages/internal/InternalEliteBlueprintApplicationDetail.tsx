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
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { AIBadge } from "@/components/disclaimers/AIBadge";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, Check, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
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
  submitted: "bg-gray-100 text-gray-700",
  under_review: "bg-blue-100 text-blue-700",
  needs_more_info: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  access_granted: "bg-purple-100 text-purple-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  received: "bg-green-100 text-green-700",
  waived: "bg-blue-100 text-blue-700",
};

export default function InternalEliteBlueprintApplicationDetail() {
  const { id } = useParams() as { id: string };
  const [application, setApplication] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [confidenceScore, setConfidenceScore] = useState("");
  const [estimatedTimeline, setEstimatedTimeline] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [includeExcellenceLab, setIncludeExcellenceLab] = useState(false);
  const [showGrantConfirm, setShowGrantConfirm] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const load = async () => {
    try {
      const r = await staffFetch(`/internal/blueprint-applications/${id}`);
      if (r.ok) {
        const d = await r.json();
        setApplication(d.application);
        setProfile(d.profile ?? null);
        setStatus(d.application.status ?? "submitted");
        setReviewNotes(d.application.adminReviewNotes ?? "");
        setConfidenceScore(String(d.application.adminConfidenceScore ?? ""));
        setEstimatedTimeline(d.application.adminEstimatedTimeline ?? "");
        setPaymentStatus(d.application.paymentStatus ?? "pending");
        setPaymentNotes(d.application.paymentNotes ?? "");
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveStatus = async () => {
    setSavingStatus(true);
    try {
      const body: Record<string, unknown> = { status, adminReviewNotes: reviewNotes };
      if (confidenceScore) body.adminConfidenceScore = parseInt(confidenceScore, 10);
      if (estimatedTimeline) body.adminEstimatedTimeline = estimatedTimeline;
      await staffFetch(`/internal/blueprint-applications/${id}/status`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } finally { setSavingStatus(false); }
  };

  const savePayment = async (newPayStatus: string) => {
    setSavingPayment(true);
    try {
      await staffFetch(`/internal/blueprint-applications/${id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: newPayStatus, paymentNotes }),
      });
      await load();
    } finally { setSavingPayment(false); }
  };

  const grantAccess = async () => {
    setGranting(true);
    try {
      const r = await staffFetch(`/internal/blueprint-applications/${id}/grant-access`, {
        method: "POST",
        body: JSON.stringify({ includeExcellenceLab }),
      });
      const d = await r.json();
      if (r.ok) {
        setGrantResult({ success: true, message: `Access granted: ${(d.productsGranted ?? []).join(", ")}` });
        await load();
      } else {
        setGrantResult({ success: false, message: d.reason ?? d.error ?? "Failed to grant access." });
      }
    } finally { setGranting(false); setShowGrantConfirm(false); }
  };

  const canGrant = application?.status === "approved" && ["received", "waived"].includes(application?.paymentStatus ?? "");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />)}</div>
        </main>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StaffNav />
        <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
          <Link href="/internal/elite-blueprint-applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> All Applications
          </Link>
          <p className="text-muted-foreground">Application not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <Link href="/internal/elite-blueprint-applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Applications
        </Link>

        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{application.fullName}</h1>
            <p className="text-muted-foreground text-sm">{application.email}{application.visaPath ? ` · ${application.visaPath.toUpperCase()}` : ""}</p>
            <p className="text-xs text-muted-foreground mt-1">Submitted {new Date(application.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-2 py-1 rounded-full text-xs font-medium capitalize", STATUS_COLORS[application.status] ?? "bg-gray-100 text-gray-600")}>
              {application.status.replace(/_/g, " ")}
            </span>
            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", PAYMENT_COLORS[application.paymentStatus ?? "pending"])}>
              Payment: {(application.paymentStatus ?? "pending").replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {grantResult && (
          <div className={cn("mb-4 p-3 rounded border text-sm", grantResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800")}>
            {grantResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Application details */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Application Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Current Role", application.currentRole],
                    ["Country", application.country],
                    ["Field", application.field],
                    ["Experience", application.yearsExperience],
                    ["Timeline", application.timeline?.replace(/_/g, " ")],
                  ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-medium capitalize">{v}</p>
                    </div>
                  ))}
                </div>
                {application.linkedinUrl && (
                  <a href={application.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#1E2D6B] hover:underline">
                    <ExternalLink className="w-3 h-3" /> LinkedIn
                  </a>
                )}
              </CardContent>
            </Card>

            {application.topAchievements && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Top Achievements</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed whitespace-pre-line">{application.topAchievements}</p></CardContent>
              </Card>
            )}

            {application.whyApplying && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Why Applying</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{application.whyApplying}</p></CardContent>
              </Card>
            )}

            {application.background && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Professional Background</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{application.background}</p></CardContent>
              </Card>
            )}

            {application.goal && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Goal</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{application.goal}</p></CardContent>
              </Card>
            )}

            {application.adminAiAnalysis && (
              <AIOutputBanner variant="analysis">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AIBadge />
                    <p className="text-xs font-medium text-purple-800">AI Case Analysis</p>
                  </div>
                  <p className="text-sm leading-relaxed">{application.adminAiAnalysis}</p>
                  {application.adminStrengtheningRoadmap && (
                    <details>
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mt-1">Strengthening Roadmap</summary>
                      <p className="mt-1 text-sm">{application.adminStrengtheningRoadmap}</p>
                    </details>
                  )}
                </div>
              </AIOutputBanner>
            )}

            {profile && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Linked Pinnacle Account</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{profile.name ?? profile.email}</p>
                  <p className="text-muted-foreground">{profile.email}</p>
                  <Badge variant="outline" className="text-xs capitalize">{profile.accessLevel?.replace(/_/g, " ")}</Badge>
                  <div>
                    <Link href={`/internal/case/${profile.id}`} className="text-xs text-[#1E2D6B] hover:underline">
                      View Full Case →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Review panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Review Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="needs_more_info">Needs More Info</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Confidence Score (1–10)</label>
                  <Input type="number" min="1" max="10" placeholder="8" value={confidenceScore}
                    onChange={(e) => setConfidenceScore(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Estimated Timeline</label>
                  <Input placeholder="e.g. 6–9 months" value={estimatedTimeline}
                    onChange={(e) => setEstimatedTimeline(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Review Notes</label>
                  <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Internal notes…" className="min-h-[80px] text-sm" />
                </div>
                <Button size="sm" onClick={saveStatus} disabled={savingStatus} className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  {savingStatus ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Save Review
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Payment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className={cn("text-center py-2 rounded-lg text-xs font-medium capitalize", PAYMENT_COLORS[application.paymentStatus ?? "pending"])}>
                  {(application.paymentStatus ?? "pending").replace(/_/g, " ")}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Payment Notes</label>
                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Invoice #123" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="text-xs"
                    disabled={savingPayment || application.paymentStatus === "received"}
                    onClick={() => savePayment("received")}>
                    Mark Received
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs"
                    disabled={savingPayment || application.paymentStatus === "waived"}
                    onClick={() => savePayment("waived")}>
                    Mark Waived
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(!canGrant && "opacity-60")}>
              <CardHeader><CardTitle className="text-sm font-semibold">Grant Access</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!canGrant && (
                  <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Requires approved status + payment received or waived.</span>
                  </div>
                )}
                {application.status === "access_granted" ? (
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <Check className="w-4 h-4" /> Access granted
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={includeExcellenceLab} onCheckedChange={(v) => setIncludeExcellenceLab(!!v)} disabled={!canGrant} />
                      Include Excellence Lab
                    </label>
                    <Button size="sm" className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                      disabled={!canGrant} onClick={() => setShowGrantConfirm(true)}>
                      Grant Access
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={showGrantConfirm} onOpenChange={setShowGrantConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Elite Blueprint Access</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">Products being granted to <strong>{application.fullName}</strong>:</p>
            <ul className="text-sm ml-4 list-disc space-y-1">
              <li>Elite Blueprint</li>
              <li>Evidence Vault</li>
              {includeExcellenceLab && <li>Excellence Lab</li>}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">Client will be notified and access updated immediately.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantConfirm(false)}>Cancel</Button>
            <Button onClick={grantAccess} disabled={granting} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {granting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Confirm Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
