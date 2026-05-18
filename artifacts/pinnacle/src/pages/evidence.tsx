import { AppLayout } from "@/components/layout/AppLayout";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { useListEvidence } from "@workspace/api-client-react";
import type { Evidence } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Upload, X, FileText, AlertCircle, ExternalLink, Download, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useProductAccess } from "@/hooks/useProductAccess";

const TOKEN_KEY = "pinnacle_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

interface EvidenceItem extends Evidence {
  primaryCriteriaId?: string | null;
  fileName?: string | null;
}

interface CriterionOption {
  criteria_id: string;
  display_name: string;
  folder_name: string;
  item_count: number;
  legal_standard?: string;
  visa_path?: string;
}

interface ExhibitDoc {
  id: number;
  documentType: string;
  exhibitLabel: string | null;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaExhibitLabel: string | null;
  fileName: string;
  driveUrl: string | null;
  generatedAt: string | null;
  publishedToClient: boolean;
}

// ─── Document type labels ─────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  criteria_exhibit: "Main Argument",
  exhibit_index: "Evidence Index",
  sub_exhibit: "Supporting Evidence",
  cover_letter: "Cover Letter",
  personal_declaration: "Personal Declaration",
  field_brief: "Field Brief",
  reco_template: "Letter Template",
};

function docTypeLabel(t: string) {
  return DOC_TYPE_LABELS[t] ?? t.replace(/_/g, " ");
}

// ─── useEvidenceCriteria ──────────────────────────────────────────────────────

function useEvidenceCriteria() {
  const [criteria, setCriteria] = useState<CriterionOption[]>([]);
  const [requiresIntake, setRequiresIntake] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetchCriteria = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/evidence/criteria", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setCriteria(d.criteria ?? []);
        setRequiresIntake(d.requiresIntake ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tick]);

  return { criteria, requiresIntake, loading, refetchCriteria };
}

// ─── useMyExhibits ────────────────────────────────────────────────────────────

function useMyExhibits() {
  const [exhibits, setExhibits] = useState<ExhibitDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/petition/my-exhibits", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => setExhibits(d.exhibits ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { exhibits, loading };
}

// ─── ExhibitsView ─────────────────────────────────────────────────────────────

function ExhibitsView() {
  const { exhibits, loading } = useMyExhibits();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (exhibits.length === 0) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <div className="w-16 h-16 rounded-full bg-[#1E2D6B]/8 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-[#1E2D6B]/60" />
          </div>
          <h3 className="text-lg font-bold mb-2 text-foreground">Documents are being prepared</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Your petition documents are being prepared. Your Pinnacle³ team will notify you when documents are ready for review.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Separate criteria-linked docs from supporting package docs
  const criteriaLinked = exhibits.filter((e) => e.criteriaCode);
  const supportingDocs = exhibits.filter((e) => !e.criteriaCode);

  // Group criteria docs by criteriaCode, preserving exhibit letter order
  const criteriaGroupMap = new Map<string, { label: string | null; name: string | null; docs: ExhibitDoc[] }>();
  for (const doc of criteriaLinked) {
    const key = doc.criteriaCode!;
    if (!criteriaGroupMap.has(key)) {
      criteriaGroupMap.set(key, { label: doc.criteriaExhibitLabel, name: doc.criteriaName, docs: [] });
    }
    criteriaGroupMap.get(key)!.docs.push(doc);
  }

  // Sort groups by exhibit label (A, B, C...) then criteriaCode as fallback
  const criteriaGroups = [...criteriaGroupMap.entries()].sort(([, a], [, b]) => {
    const al = a.label ?? "";
    const bl = b.label ?? "";
    return al.localeCompare(bl);
  });

  const docTypeOrder = ["criteria_exhibit", "exhibit_index", "sub_exhibit"];
  const sortDocs = (docs: ExhibitDoc[]) =>
    [...docs].sort((a, b) => {
      const ai = docTypeOrder.indexOf(a.documentType);
      const bi = docTypeOrder.indexOf(b.documentType);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div className="space-y-6">
      {/* Criteria sections */}
      {criteriaGroups.length > 0 && (
        <div className="space-y-4">
          {criteriaGroups.map(([code, group]) => (
            <div key={code}>
              <div className="flex items-center gap-2 mb-2">
                {group.label && (
                  <span className="w-7 h-7 rounded-full bg-[#1E2D6B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {group.label}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-sm text-[#1E2D6B]">
                    {group.label ? `Criterion ${group.label}` : "Criterion"}{group.name ? ` — ${group.name}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {group.docs.length} document{group.docs.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <Card>
                <CardContent className="p-0 divide-y">
                  {sortDocs(group.docs).map((doc) => (
                    <ExhibitRow key={doc.id} doc={doc} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Supporting documents */}
      {supportingDocs.length > 0 && (
        <div>
          <p className="font-semibold text-sm text-[#1E2D6B] mb-2">Supporting Documents</p>
          <Card>
            <CardContent className="p-0 divide-y">
              {supportingDocs.map((doc) => (
                <ExhibitRow key={doc.id} doc={doc} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ExhibitRow ───────────────────────────────────────────────────────────────

function ExhibitRow({ doc }: { doc: ExhibitDoc }) {
  const typeLabel = docTypeLabel(doc.documentType);
  const dateStr = doc.generatedAt
    ? new Date(doc.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-[#1E2D6B]/8 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-[#1E2D6B]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#1E2D6B]/8 text-[#1E2D6B] font-medium">
            {typeLabel}
          </span>
          {dateStr && <span className="text-xs text-muted-foreground">{dateStr}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {doc.driveUrl ? (
          <>
            <Button
              size="sm" variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => window.open(doc.driveUrl!, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-[#1E2D6B] hover:bg-[#3D4FA8]"
              onClick={() => window.open(doc.driveUrl!, "_blank")}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">No file attached</span>
        )}
      </div>
    </div>
  );
}

// ─── Main EvidenceVault page ──────────────────────────────────────────────────

type ActiveTab = "evidence" | "exhibits";

export default function EvidenceVault() {
  const { data: evidenceList, isLoading, refetch } = useListEvidence();
  const { criteria, requiresIntake, loading: criteriaLoading } = useEvidenceCriteria();
  const { hasEvidenceVault } = useProductAccess();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("evidence");

  // Form state
  const [criteriaId, setCriteriaId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setCriteriaId("");
    setDescription("");
    setSelectedFiles([]);
  }, []);

  const handleFilesChosen = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...arr.filter((f) => !names.has(f.name + f.size))];
    });
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesChosen(e.dataTransfer.files);
  };

  const onSubmit = async () => {
    if (!criteriaId) { toast({ title: "Please select a USCIS criterion", variant: "destructive" }); return; }
    if (selectedFiles.length === 0) { toast({ title: "Please select at least one file", variant: "destructive" }); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("criteria_id", criteriaId);
      if (description.trim()) fd.append("description", description.trim());
      for (const file of selectedFiles) fd.append("files", file);

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Upload failed", variant: "destructive" });
        return;
      }

      const count = data.count ?? data.items?.length ?? 1;
      toast({ title: `${count} document${count > 1 ? "s" : ""} uploaded successfully` });
      setOpen(false);
      resetForm();
      refetch();
    } catch {
      toast({ title: "Network error — please try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-amber-100 text-amber-800";
      case "draft": return "bg-gray-100 text-gray-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Evidence Engine</h1>
          <p className="text-muted-foreground mt-1">Secure repository for your professional artifacts, mapped to USCIS criteria.</p>
        </div>

        {activeTab === "evidence" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  <Plus className="w-4 h-4 mr-2" /> Add Evidence
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                  <DialogTitle>Upload Evidence Documents</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                  {requiresIntake && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Please complete your Readiness Intake before uploading documents.</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="criterion">USCIS Criterion <span className="text-red-500">*</span></Label>
                    <Select value={criteriaId} onValueChange={setCriteriaId} disabled={requiresIntake || criteriaLoading}>
                      <SelectTrigger id="criterion">
                        <SelectValue placeholder={criteriaLoading ? "Loading criteria…" : "Select a criterion"} />
                      </SelectTrigger>
                      <SelectContent>
                        {criteria.map((c) => (
                          <SelectItem key={c.criteria_id} value={c.criteria_id}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{c.criteria_id}</span>
                            {c.display_name}
                            {c.item_count > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">({c.item_count})</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Documents <span className="text-red-500">*</span></Label>
                    <div
                      className={cn(
                        "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
                        dragOver ? "border-[#1E2D6B] bg-[#1E2D6B]/5" : "border-border hover:border-[#1E2D6B]/40 hover:bg-gray-50",
                        requiresIntake && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                    >
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT supported · Multiple files allowed</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => handleFilesChosen(e.target.files)}
                      />
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
                      </p>
                      <div className="rounded-lg border divide-y max-h-44 overflow-y-auto">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-3 px-3 py-2">
                            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description / Context <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Textarea
                      id="description"
                      placeholder="Brief context about this evidence and how it supports your petition…"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={requiresIntake}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button
                      className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                      onClick={onSubmit}
                      disabled={uploading || requiresIntake || !criteriaId || selectedFiles.length === 0}
                    >
                      {uploading
                        ? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}…`
                        : `Upload ${selectedFiles.length > 0 ? selectedFiles.length + " " : ""}Document${selectedFiles.length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b mb-6">
        {([
          { key: "evidence", label: "My Evidence" },
          { key: "exhibits", label: "Petition Documents" },
        ] as { key: ActiveTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === key
                ? "border-[#1E2D6B] text-[#1E2D6B]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── My Evidence tab ── */}
      {activeTab === "evidence" && (
        <>
          <AIOutputBanner variant="analysis" />

          <div className="flex flex-col md:flex-row gap-4 mb-6 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search evidence…" className="pl-9" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !evidenceList || evidenceList.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No evidence uploaded yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Begin by uploading artifacts that substantiate your achievements — publications, awards, letters, and more.
                </p>
                <Button onClick={() => setOpen(true)} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  <Upload className="w-4 h-4 mr-2" /> Upload Your First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(evidenceList as EvidenceItem[]).map((evidence) => (
                <Link key={evidence.id} href={`/evidence/${evidence.id}`}>
                  <Card className="hover:border-[#1E2D6B]/50 transition-colors cursor-pointer">
                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#1E2D6B]/8 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#1E2D6B]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="font-bold text-foreground truncate">{evidence.title}</h3>
                            <Badge variant="secondary" className={getStatusColor(evidence.status)}>
                              {evidence.status.charAt(0).toUpperCase() + evidence.status.slice(1)}
                            </Badge>
                            {(evidence as EvidenceItem).primaryCriteriaId && (
                              <Badge variant="outline" className="text-xs font-mono">{(evidence as EvidenceItem).primaryCriteriaId}</Badge>
                            )}
                          </div>
                          {evidence.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{evidence.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {(evidence as EvidenceItem).fileName && <span className="truncate max-w-[200px]">{(evidence as EvidenceItem).fileName}</span>}
                            {evidence.dateAchieved && <span>• {new Date(evidence.dateAchieved).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">View Details</Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Petition Documents tab ── */}
      {activeTab === "exhibits" && <ExhibitsView />}
    </AppLayout>
  );
}
