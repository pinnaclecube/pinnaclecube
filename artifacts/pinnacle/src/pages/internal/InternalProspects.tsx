import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { Search, Users, ChevronRight, Plus, BookOpen, Trophy, Briefcase, CreditCard, CheckCircle, Clock, AlertCircle, Send } from "lucide-react";
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

const SOURCE_FILTERS = [
  { key: "all", label: "All" },
  { key: "booth", label: "Booth" },
  { key: "contact_form", label: "Contact Form" },
  { key: "quiz", label: "Quiz" },
  { key: "manual", label: "Manual" },
] as const;

type SourceFilter = typeof SOURCE_FILTERS[number]["key"];

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  booth: { label: "Booth", cls: "bg-indigo-100 text-indigo-700" },
  contact_form: { label: "Contact Form", cls: "bg-sky-100 text-sky-700" },
  quiz: { label: "Quiz", cls: "bg-amber-100 text-amber-700" },
  manual: { label: "Manual", cls: "bg-gray-100 text-gray-500" },
};

export default function InternalProspects() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", currentRole: "", fieldOfWork: "", sourceType: "manual" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await staffFetch("/admin/prospects");
      if (res.ok) {
        const data = await res.json();
        setProspects(data.prospects ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createProspect = async () => {
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      const r = await staffFetch("/admin/prospects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setShowAddModal(false);
        setForm({ fullName: "", email: "", phone: "", currentRole: "", fieldOfWork: "", sourceType: "manual" });
        await load();
      }
    } finally { setSaving(false); }
  };

  const filtered = prospects.filter((p: any) => {
    const matchesSearch =
      (p.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.currentRole ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesSource =
      sourceFilter === "all" ||
      (p.sourceType ?? "manual") === sourceFilter;

    return matchesSearch && matchesSource;
  });

  const countFor = (key: SourceFilter) =>
    key === "all"
      ? prospects.length
      : prospects.filter((p) => (p.sourceType ?? "manual") === key).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Prospects</h2>
            <p className="text-sm text-muted-foreground">{prospects.length} total</p>
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
            <Plus className="w-4 h-4 mr-1.5" /> Add Prospect
          </Button>
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSourceFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                sourceFilter === f.key
                  ? "bg-[#1E2D6B] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50",
              )}
            >
              {f.label}
              <span className={cn(
                "ml-1.5 text-xs",
                sourceFilter === f.key ? "text-white/70" : "text-muted-foreground",
              )}>
                {countFor(f.key)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…" className="pl-9" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No matching prospects." : "No prospects yet."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((p: any) => {
              const src = SOURCE_BADGE[p.sourceType ?? "manual"] ?? SOURCE_BADGE.manual;
              return (
                <Link key={p.id} href={`/internal/prospect/${p.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center text-[#1E2D6B] font-bold shrink-0">
                            {(p.fullName ?? p.email ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{p.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.email}{p.currentRole ? ` · ${p.currentRole}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.publicationsSignal && <BookOpen className="w-3.5 h-3.5 text-blue-500" title="Publications" />}
                          {p.awardsSignal && <Trophy className="w-3.5 h-3.5 text-yellow-500" title="Awards" />}
                          {p.leadershipSignal && <Briefcase className="w-3.5 h-3.5 text-green-500" title="Leadership" />}
                          {p.linkStatus === "paid" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700" title={`Payment received ${p.paymentReceivedAt ? new Date(p.paymentReceivedAt).toLocaleDateString() : ""}`}>
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          )}
                          {p.linkStatus === "active" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Active payment link — sent ${p.invoiceSentAt ? new Date(p.invoiceSentAt).toLocaleDateString() : ""}`}>
                              <CreditCard className="w-3 h-3" /> Link Active
                            </span>
                          )}
                          {p.linkStatus === "expired" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title={`Payment link expired — sent ${p.invoiceSentAt ? new Date(p.invoiceSentAt).toLocaleDateString() : ""}`}>
                              <AlertCircle className="w-3 h-3" /> Link Expired
                            </span>
                          )}
                          {p.linkStatus === "sent" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" title={`Proposal sent ${p.invoiceSentAt ? new Date(p.invoiceSentAt).toLocaleDateString() : ""}`}>
                              <Send className="w-3 h-3" /> Proposal Sent
                            </span>
                          )}
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", src.cls)}>
                            {src.label}
                          </span>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[p.status ?? "new"] ?? "bg-gray-100 text-gray-600")}>
                            {(p.status ?? "new").replace(/_/g, " ")}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">{p.registrationStatus?.replace(/_/g, " ") ?? "not invited"}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Prospect</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name <span className="text-red-500">*</span></label>
              <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Current Role</label>
              <Input value={form.currentRole} onChange={(e) => setForm((p) => ({ ...p, currentRole: e.target.value }))} placeholder="Senior Software Engineer" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Field Of Work</label>
              <Input value={form.fieldOfWork} onChange={(e) => setForm((p) => ({ ...p, fieldOfWork: e.target.value }))} placeholder="Artificial Intelligence" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={createProspect} disabled={saving || !form.fullName.trim()} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              {saving ? "Creating…" : "Add Prospect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
