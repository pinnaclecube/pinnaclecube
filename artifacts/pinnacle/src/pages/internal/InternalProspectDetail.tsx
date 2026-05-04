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
import { ArrowLeft, BookOpen, Trophy, Briefcase, Mail, ExternalLink, Check, RefreshCw, Upload, FileText, Sparkles, Download, Send, ChevronDown, ChevronUp, Loader2, CreditCard, UserCheck, Copy, CheckCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const VISA_CATEGORIES = ["EB-1A", "EB-2 NIW", "O-1A"];

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

  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<string | null>(null);
  const [selectedVisa, setSelectedVisa] = useState("EB-1A");
  const [roadmapGenerating, setRoadmapGenerating] = useState(false);
  const [roadmapData, setRoadmapData] = useState<any>(null);
  const [roadmapExpanded, setRoadmapExpanded] = useState(false);
  const [roadmapSending, setRoadmapSending] = useState(false);
  const [roadmapSendMsg, setRoadmapSendMsg] = useState<string | null>(null);

  const [invoiceProduct, setInvoiceProduct] = useState("excellence_lab");
  const [eliteAmount, setEliteAmount] = useState<string>("");
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<"open" | "expired" | "none" | "unconfigured" | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);

  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState<string | null>(null);

  const fetchSessionStatus = async (prospectId: string) => {
    try {
      const r = await staffFetch(`/admin/prospects/${prospectId}/invoice/status`);
      if (r.ok) {
        const d = await r.json();
        setSessionStatus(d.status ?? null);
        setSessionExpiresAt(d.expiresAt ? new Date(d.expiresAt) : null);
      }
    } catch { /* ignore */ }
  };

  const load = async () => {
    try {
      const r = await staffFetch(`/admin/prospects/${id}`);
      if (r.ok) {
        const d = await r.json();
        setProspect(d.prospect);
        setEditForm(d.prospect);
        if (d.prospect.roadmapContent) {
          try { setRoadmapData(JSON.parse(d.prospect.roadmapContent)); } catch { /* ignore */ }
        }
        if (d.prospect.roadmapVisaCategory) setSelectedVisa(d.prospect.roadmapVisaCategory);
        if (d.prospect.invoiceCheckoutUrl) {
          setInvoiceUrl(d.prospect.invoiceCheckoutUrl);
          fetchSessionStatus(id);
        } else {
          setInvoiceUrl(null);
          setSessionStatus(null);
          setSessionExpiresAt(null);
        }
        if (d.prospect.invoiceProduct) setInvoiceProduct(d.prospect.invoiceProduct);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const uploadResume = async (file: File) => {
    setResumeUploading(true);
    setResumeMsg(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      const r = await fetch(`/api/admin/prospects/${id}/resume`, {
        method: "POST",
        headers: { "X-Staff-Token": getStaffToken() ?? "" },
        body: form,
      });
      const d = await r.json();
      if (r.ok) {
        setResumeMsg(`Resume uploaded: ${d.fileName}`);
        setRoadmapData(null);
        await load();
      } else {
        setResumeMsg(d.error ?? "Upload failed");
      }
    } catch { setResumeMsg("Upload failed"); }
    setResumeUploading(false);
  };

  const generateRoadmap = async () => {
    setRoadmapGenerating(true);
    setRoadmapSendMsg(null);
    try {
      const r = await staffFetch(`/admin/prospects/${id}/roadmap/generate`, {
        method: "POST",
        body: JSON.stringify({ visaCategory: selectedVisa }),
      });
      const d = await r.json();
      if (r.ok) {
        setRoadmapData(d.roadmap);
        setRoadmapExpanded(false);
        await load();
      } else {
        alert(d.error ?? "Generation failed");
      }
    } catch { alert("Generation failed — check your connection and try again."); }
    setRoadmapGenerating(false);
  };

  const sendRoadmap = async () => {
    setRoadmapSending(true);
    setRoadmapSendMsg(null);
    try {
      const r = await staffFetch(`/admin/prospects/${id}/roadmap/send`, { method: "POST" });
      const d = await r.json();
      setRoadmapSendMsg(r.ok ? (d.message ?? "Roadmap sent!") : (d.error ?? "Send failed"));
    } catch { setRoadmapSendMsg("Send failed"); }
    setRoadmapSending(false);
  };

  const downloadRoadmap = async (format: "pdf" | "docx") => {
    try {
      const r = await staffFetch(`/admin/prospects/${id}/roadmap/download/${format}`);
      if (!r.ok) { alert("Download failed"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "pdf" ? "pdf" : "docx";
      a.download = `${(prospect?.fullName ?? "Roadmap").replace(/\s+/g, "_")}_Roadmap.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Download failed"); }
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

  const sendInvoice = async () => {
    if (invoiceProduct === "elite_blueprint") {
      const amt = parseInt(eliteAmount, 10);
      if (!eliteAmount || isNaN(amt) || amt < 1) {
        setInvoiceMsg("Please enter a valid dollar amount for Elite Blueprint.");
        return;
      }
    }
    setInvoiceSending(true);
    setInvoiceMsg(null);
    try {
      const body: Record<string, unknown> = { product: invoiceProduct };
      if (invoiceProduct === "elite_blueprint") body.customAmount = parseInt(eliteAmount, 10);
      const r = await staffFetch(`/admin/prospects/${id}/invoice`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setInvoiceUrl(d.checkoutUrl);
        const reused = d.reusingExistingSession;
        setInvoiceMsg(reused
          ? `Proposal resent to ${prospect?.email} using the existing payment link!`
          : `Proposal sent to ${prospect?.email}!`
        );
        await load();
      } else {
        setInvoiceMsg(d.error ?? "Failed to send proposal");
      }
    } catch { setInvoiceMsg("Failed to send proposal"); }
    setInvoiceSending(false);
  };

  const copyLink = () => {
    if (!invoiceUrl) return;
    navigator.clipboard.writeText(invoiceUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const convertCase = async () => {
    setConverting(true);
    setConvertMsg(null);
    try {
      const r = await staffFetch(`/admin/prospects/${id}/convert`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setConvertMsg("Prospect converted to case!");
        await load();
      } else {
        setConvertMsg(d.error ?? "Conversion failed");
      }
    } catch { setConvertMsg("Conversion failed"); }
    setConverting(false);
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
  const roadmapReady = Boolean(roadmapData || prospect.roadmapGeneratedAt);
  const invoiceLocked = !roadmapReady && !prospect.invoiceSentAt && !prospect.paymentReceivedAt;

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
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
            {prospect.paymentReceivedAt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                <CheckCircle className="w-3.5 h-3.5" /> Paid
              </span>
            )}
            {prospect.status !== "converted" && (
              <Button
                size="sm"
                onClick={convertCase}
                disabled={converting}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                {converting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Converting…</>
                  : <><UserCheck className="w-3.5 h-3.5 mr-1.5" />Convert to Case</>
                }
              </Button>
            )}
          </div>
        </div>

        {inviteResult && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
            {inviteResult}
          </div>
        )}
        {convertMsg && (
          <div className={cn("mb-4 p-3 rounded text-sm border", convertMsg.includes("failed") || convertMsg.includes("Failed") ? "bg-red-50 border-red-200 text-red-800" : "bg-purple-50 border-purple-200 text-purple-800")}>
            {convertMsg}
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

          {/* ── Resume & Roadmap Card ── */}
          <Card className="border-indigo-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1E2D6B]" />
                  Resume & AI Roadmap
                </CardTitle>
                {prospect.roadmapGeneratedAt && (
                  <span className="text-xs text-muted-foreground">
                    Generated {new Date(prospect.roadmapGeneratedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resume upload */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Resume File</label>
                <div className="flex items-center gap-3">
                  <label className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors",
                    resumeUploading ? "opacity-50 pointer-events-none" : "hover:bg-gray-50 border-gray-200"
                  )}>
                    {resumeUploading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</>
                      : <><Upload className="w-3.5 h-3.5" />{prospect.resumeFileName ? "Replace Resume" : "Upload Resume"}</>
                    }
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])}
                      disabled={resumeUploading}
                    />
                  </label>
                  {prospect.resumeFileName && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                      <FileText className="w-3 h-3" /> {prospect.resumeFileName}
                    </span>
                  )}
                </div>
                {resumeMsg && (
                  <p className={cn("text-xs mt-1.5", resumeMsg.includes("failed") || resumeMsg.includes("Failed") ? "text-red-600" : "text-green-700")}>
                    {resumeMsg}
                  </p>
                )}
              </div>

              {/* Generate section */}
              {prospect.resumeFileName && (
                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs font-medium text-muted-foreground block">Target Visa Category</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {VISA_CATEGORIES.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSelectedVisa(v)}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                            selectedVisa === v
                              ? "bg-[#1E2D6B] text-white border-[#1E2D6B]"
                              : "text-gray-600 border-gray-200 hover:border-[#1E2D6B] hover:text-[#1E2D6B]"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={generateRoadmap}
                      disabled={roadmapGenerating}
                      className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                    >
                      {roadmapGenerating
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                        : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{roadmapData ? "Regenerate Roadmap" : "Generate Roadmap"}</>
                      }
                    </Button>
                  </div>
                  {roadmapGenerating && (
                    <p className="text-xs text-indigo-600">Claude is analyzing the resume and building the roadmap — this takes 30–60 seconds…</p>
                  )}
                </div>
              )}

              {/* Roadmap actions */}
              {roadmapData && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {roadmapData.visaCategory} Roadmap — {roadmapData.executiveSummary?.strongCriteria ?? "?"} strong criteria · {roadmapData.confidenceAnalysis?.postConfidenceLow}–{roadmapData.confidenceAnalysis?.postConfidenceHigh}% projected approval
                    </p>
                    <button
                      onClick={() => setRoadmapExpanded((v) => !v)}
                      className="text-xs text-[#1E2D6B] flex items-center gap-1 hover:underline"
                    >
                      {roadmapExpanded ? <><ChevronUp className="w-3 h-3" />Collapse</> : <><ChevronDown className="w-3 h-3" />Preview</>}
                    </button>
                  </div>

                  {/* Roadmap preview */}
                  {roadmapExpanded && (
                    <div className="bg-gray-50 border rounded-md p-4 text-xs space-y-3 max-h-80 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-50 border border-red-100 rounded p-2 text-center">
                          <p className="text-red-700 font-bold text-lg">{roadmapData.confidenceAnalysis?.currentConfidenceLow}–{roadmapData.confidenceAnalysis?.currentConfidenceHigh}%</p>
                          <p className="text-red-600 text-xs">Current approval confidence</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded p-2 text-center">
                          <p className="text-green-700 font-bold text-lg">{roadmapData.confidenceAnalysis?.postConfidenceLow}–{roadmapData.confidenceAnalysis?.postConfidenceHigh}%</p>
                          <p className="text-green-600 text-xs">After Pinnacle³ guidance</p>
                        </div>
                      </div>
                      {roadmapData.roadmapPhases?.map((phase: any) => (
                        <div key={phase.phaseNumber} className="border-l-2 border-indigo-200 pl-3">
                          <p className="font-semibold text-[#1E2D6B]">{phase.title} — {phase.timeline}</p>
                          <ul className="mt-1 space-y-0.5 text-gray-600">
                            {phase.steps?.slice(0, 3).map((step: string, i: number) => (
                              <li key={i}>✓ {step}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Download & Send */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => downloadRoadmap("pdf")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                    <button
                      onClick={() => downloadRoadmap("docx")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Word
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={sendRoadmap}
                      disabled={roadmapSending}
                      className="text-xs h-7 border-indigo-200 text-[#1E2D6B] hover:bg-indigo-50"
                    >
                      {roadmapSending
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Sending…</>
                        : <><Send className="w-3.5 h-3.5 mr-1" />Email to {prospect.email}</>
                      }
                    </Button>
                  </div>
                  {roadmapSendMsg && (
                    <p className={cn("text-xs", roadmapSendMsg.includes("failed") || roadmapSendMsg.includes("Failed") ? "text-red-600" : "text-green-700")}>
                      {roadmapSendMsg}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Proposal & Invoice Card ── */}
          <Card className={cn("border-purple-100", invoiceLocked && "opacity-75")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-700" />
                Proposal & Invoice
                {invoiceLocked && <Lock className="w-3.5 h-3.5 text-gray-400 ml-1" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoiceLocked && (
                <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-500">Generate a roadmap above to unlock this section.</p>
                </div>
              )}
              {prospect.paymentReceivedAt && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-800">
                    Payment received {new Date(prospect.paymentReceivedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {prospect.invoiceSentAt ? (
                <div className={cn("border rounded-lg p-4 space-y-3", prospect.paymentReceivedAt ? "bg-gray-50 border-gray-200" : "bg-purple-50 border-purple-200")}>
                  <div className="flex items-center gap-2">
                    <Check className={cn("w-4 h-4", prospect.paymentReceivedAt ? "text-gray-500" : "text-purple-700")} />
                    <p className={cn("text-sm font-medium", prospect.paymentReceivedAt ? "text-gray-700" : "text-purple-900")}>
                      Proposal sent {new Date(prospect.invoiceSentAt).toLocaleDateString()} —{" "}
                      {prospect.invoiceProduct === "excellence_lab"
                        ? "Excellence Lab ($249)"
                        : prospect.invoiceProduct === "evidence_vault"
                        ? "Evidence Engine ($49/mo)"
                        : prospect.invoiceProduct === "elite_blueprint"
                        ? "Elite Blueprint (custom)"
                        : prospect.invoiceProduct ?? "Unknown product"}
                    </p>
                  </div>

                  {/* Session status badge */}
                  {sessionStatus && sessionStatus !== "none" && sessionStatus !== "unconfigured" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {sessionStatus === "open" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3" /> Link active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                          Link expired
                        </span>
                      )}
                      {sessionStatus === "open" && sessionExpiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expires {sessionExpiresAt.toLocaleDateString()} at {sessionExpiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  )}

                  {invoiceUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-purple-700 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Open payment link
                      </a>
                      <button
                        onClick={copyLink}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs transition-colors",
                          linkCopied ? "text-green-600" : "text-gray-500 hover:text-gray-700"
                        )}
                        title="Copy link to clipboard"
                      >
                        {linkCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy link</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className={cn("space-y-3", invoiceLocked && "pointer-events-none select-none")}>
                <label className="text-xs font-medium text-muted-foreground block">Product to Invoice</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "excellence_lab", label: "Excellence Lab", price: "$249" },
                    { key: "evidence_vault", label: "Evidence Engine", price: "$49/mo" },
                    { key: "elite_blueprint", label: "Elite Blueprint", price: "Custom" },
                  ].map(({ key, label, price }) => (
                    <button
                      key={key}
                      disabled={invoiceLocked}
                      onClick={() => { setInvoiceProduct(key); setInvoiceMsg(null); }}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-medium border transition-colors text-left",
                        invoiceLocked
                          ? "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
                          : invoiceProduct === key
                            ? "bg-purple-700 text-white border-purple-700"
                            : "text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"
                      )}
                    >
                      <span className="block">{label}</span>
                      <span className="block text-xs opacity-75">{price}</span>
                    </button>
                  ))}
                </div>

                {invoiceProduct === "elite_blueprint" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">Invoice Amount</label>
                    <div className="relative w-40">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 4999"
                        value={eliteAmount}
                        disabled={invoiceLocked}
                        onChange={(e) => setEliteAmount(e.target.value)}
                        className={cn(
                          "w-full pl-7 pr-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent",
                          invoiceLocked ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-gray-200"
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Whole dollar amount — no decimals needed</p>
                  </div>
                )}

                {!prospect.email && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Prospect has no email address — add one before sending a proposal.
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={sendInvoice}
                    disabled={invoiceSending || !prospect.email || invoiceLocked}
                    className="bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    {invoiceSending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending…</>
                      : <><Send className="w-3.5 h-3.5 mr-1.5" />{prospect.invoiceSentAt ? "Resend Proposal" : "Send Proposal & Payment Link"}</>
                    }
                  </Button>
                  {prospect.invoiceSentAt && sessionStatus === "open" && invoiceProduct === prospect.invoiceProduct && (
                    <span className="text-xs text-green-700">Will reuse existing active link</span>
                  )}
                  {prospect.invoiceSentAt && (sessionStatus === "expired" || invoiceProduct !== prospect.invoiceProduct) && (
                    <span className="text-xs text-amber-700">Will generate a new payment link</span>
                  )}
                  {!prospect.invoiceSentAt && (
                    prospect.roadmapContent
                      ? <span className="text-xs text-green-700">Roadmap PDF will be attached</span>
                      : <span className="text-xs text-muted-foreground">Generate a roadmap to include PDF</span>
                  )}
                </div>

                {invoiceMsg && (
                  <p className={cn("text-xs", invoiceMsg.includes("failed") || invoiceMsg.includes("Failed") ? "text-red-600" : "text-green-700")}>
                    {invoiceMsg}
                  </p>
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
