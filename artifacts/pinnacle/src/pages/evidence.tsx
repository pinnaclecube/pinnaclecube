import { AppLayout } from "@/components/layout/AppLayout";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { useListEvidence } from "@workspace/api-client-react";
import type { Evidence } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Upload, X, FileText, AlertCircle, CloudDownload, RefreshCw, FolderOpen, Link2, CheckCircle2, ExternalLink, HardDriveDownload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DriveFileBrowser } from "@/components/evidence/DriveFileBrowser";
import { useProductAccess } from "@/hooks/useProductAccess";

const TOKEN_KEY = "pinnacle_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

interface EvidenceItem extends Evidence {
  primaryCriteriaId?: string | null;
  fileName?: string | null;
  source?: string | null;
}

interface CriterionOption {
  criteria_id: string;
  display_name: string;
  folder_name: string;
  item_count: number;
  drive_folder_url?: string | null;
  legal_standard?: string;
  visa_path?: string;
}

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

interface DriveSyncInfo {
  lastDriveSyncAt: string | null;
  unreadDriveNotifications: number;
}

function useDriveSync() {
  const [syncInfo, setSyncInfo] = useState<DriveSyncInfo | null>(null);

  useEffect(() => {
    fetch("/api/evidence/drive-sync", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSyncInfo(d))
      .catch(() => {});
  }, []);

  const clearBadge = useCallback(() => {
    setSyncInfo((prev) => prev ? { ...prev, unreadDriveNotifications: 0 } : prev);
  }, []);

  return { syncInfo, clearBadge };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function EvidenceVault() {
  const { data: evidenceList, isLoading, refetch } = useListEvidence();
  const { criteria, requiresIntake, loading: criteriaLoading, refetchCriteria } = useEvidenceCriteria();
  const { syncInfo: driveSync, clearBadge } = useDriveSync();
  const { hasEvidenceVault } = useProductAccess();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"evidence" | "drive">("evidence");
  const driveToastShown = useRef(false);

  const hasDriveFolders = criteria.some((c) => c.drive_folder_url);

  // ── Drive provisioning polling ─────────────────────────────────────────────
  // When the user has an Evidence Vault subscription but no criteria folders
  // are connected yet, poll every 5 s (up to 60 s) so the tab self-updates
  // the moment auto-provisioning completes in the background.
  //
  // Split into three effects so the polling interval is NEVER torn down and
  // restarted mid-flight just because criteriaLoading flips during a refetch.
  const [isProvisioningDrive, setIsProvisioningDrive] = useState(false);
  const [justProvisioned, setJustProvisioned] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  // Becomes true once the first successful criteria load completes (avoids
  // criteriaLoading being a dep of the interval-management effect).
  const [criteriaReady, setCriteriaReady] = useState(false);

  // Effect 1: detect when the first criteria fetch completes (regardless of
  // list length) so Effect 2 never needs criteriaLoading as a dependency.
  useEffect(() => {
    if (!criteriaLoading && !criteriaReady) {
      setCriteriaReady(true);
    }
  }, [criteriaLoading, criteriaReady]);

  // Effect 2: manage the stable polling interval
  // Deps intentionally exclude criteriaLoading so loading cycles during refetch
  // do NOT tear down and restart the interval or reset the counter.
  // Guard !requiresIntake ensures we never poll when intake is incomplete —
  // auto-provisioning only runs after intake + visa path are set.
  useEffect(() => {
    if (!criteriaReady || !hasEvidenceVault || hasDriveFolders || requiresIntake) {
      return;
    }

    setIsProvisioningDrive(true);
    pollCountRef.current = 0;

    // Kick off an immediate first check rather than waiting 5 s.
    refetchCriteria();

    pollIntervalRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= 12) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsProvisioningDrive(false);
        return;
      }
      refetchCriteria();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [criteriaReady, hasEvidenceVault, hasDriveFolders, requiresIntake, refetchCriteria]);

  // Effect 3: fire the success UI when hasDriveFolders transitions to true.
  // Auto-dismiss the banner after 8 s so it is transient rather than permanent.
  useEffect(() => {
    if (hasDriveFolders && isProvisioningDrive) {
      setIsProvisioningDrive(false);
      setJustProvisioned(true);
      toast({
        title: "Your Drive folders are ready",
        description: "Files you drop into these folders will sync automatically into your Evidence Engine.",
      });
      const t = setTimeout(() => setJustProvisioned(false), 8000);
      return () => clearTimeout(t);
    }
  }, [hasDriveFolders, isProvisioningDrive, toast]);

  const clientDriveFetchFn = useMemo(
    () => () =>
      fetch("/api/evidence/drive-files", {
        headers: { Authorization: `Bearer ${getToken()}` },
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to load Drive files");
        return r.json();
      }),
    [],
  );

  useEffect(() => {
    if (driveToastShown.current) return;
    if (driveSync && driveSync.unreadDriveNotifications > 0) {
      driveToastShown.current = true;
      const count = driveSync.unreadDriveNotifications;
      toast({
        title: "New evidence ingested",
        description: `${count} new document${count > 1 ? "s" : ""} were automatically synced from your Drive.`,
      });
      fetch("/api/notifications/read-by-type", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ type: "drive_ingest" }),
      }).catch(() => {});
      clearBadge();
    }
  }, [driveSync, toast, clearBadge]);

  // Form state
  const [criteriaId, setCriteriaId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connect Drive folder dialog state
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveCriteriaId, setDriveCriteriaId] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveConnecting, setDriveConnecting] = useState(false);

  const resetForm = useCallback(() => {
    setCriteriaId("");
    setDescription("");
    setSelectedFiles([]);
  }, []);

  const resetDriveForm = useCallback(() => {
    setDriveCriteriaId("");
    setDriveFolderUrl("");
  }, []);

  const onConnectDriveFolder = async () => {
    if (!driveCriteriaId) {
      toast({ title: "Please select a USCIS criterion", variant: "destructive" });
      return;
    }
    const trimmed = driveFolderUrl.trim();
    if (!trimmed) {
      toast({ title: "Please paste a Google Drive folder link", variant: "destructive" });
      return;
    }
    if (!trimmed.includes("/folders/")) {
      toast({
        title: "Invalid Drive URL",
        description: "Expected a link like https://drive.google.com/drive/folders/…",
        variant: "destructive",
      });
      return;
    }

    setDriveConnecting(true);
    try {
      const res = await fetch("/api/evidence/drive-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ criteria_id: driveCriteriaId, folder_url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Could not connect folder", variant: "destructive" });
        return;
      }
      toast({ title: "Drive folder connected", description: "New files will be ingested automatically on the next sync." });
      setDriveOpen(false);
      resetDriveForm();
      refetch();
      refetchCriteria();
    } catch {
      toast({ title: "Network error — please try again", variant: "destructive" });
    } finally {
      setDriveConnecting(false);
    }
  };

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Evidence Engine</h1>
          <p className="text-muted-foreground mt-2">Secure repository for your professional artifacts, mapped to USCIS criteria.</p>
          {driveSync?.lastDriveSyncAt && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>Last Drive sync: {formatRelativeTime(driveSync.lastDriveSyncAt)}</span>
              {driveSync.unreadDriveNotifications > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  {driveSync.unreadDriveNotifications} new
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Connect Drive Folder dialog */}
          <Dialog open={driveOpen} onOpenChange={(v) => { setDriveOpen(v); if (!v) resetDriveForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5">
                <FolderOpen className="w-4 h-4 mr-2" /> Connect Drive Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Connect a Google Drive Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <p className="text-sm text-muted-foreground">
                  Share a Google Drive folder with Pinnacle and any files you drop in it will be
                  automatically ingested as evidence on the next sync cycle.
                </p>

                {requiresIntake && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Please complete your Readiness Intake before connecting a folder.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="drive-criterion">USCIS Criterion <span className="text-red-500">*</span></Label>
                  <Select
                    value={driveCriteriaId}
                    onValueChange={setDriveCriteriaId}
                    disabled={requiresIntake || criteriaLoading}
                  >
                    <SelectTrigger id="drive-criterion">
                      <SelectValue placeholder={criteriaLoading ? "Loading criteria…" : "Select a criterion"} />
                    </SelectTrigger>
                    <SelectContent>
                      {criteria.map((c) => (
                        <SelectItem key={c.criteria_id} value={c.criteria_id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{c.criteria_id}</span>
                          {c.display_name}
                          {c.drive_folder_url && (
                            <span className="ml-2 text-xs text-green-600 font-medium">● connected</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="drive-url">Google Drive Folder Link <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="drive-url"
                      className="pl-9"
                      placeholder="https://drive.google.com/drive/folders/…"
                      value={driveFolderUrl}
                      onChange={(e) => setDriveFolderUrl(e.target.value)}
                      disabled={requiresIntake}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Make sure the folder is shared with the Pinnacle service account so files can be read automatically.
                  </p>
                </div>

                {/* Show currently connected folder if criterion is selected */}
                {driveCriteriaId && criteria.find((c) => c.criteria_id === driveCriteriaId)?.drive_folder_url && (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">Folder already connected.</span>
                      {" "}Pasting a new link will replace it.{" "}
                      <a
                        href={criteria.find((c) => c.criteria_id === driveCriteriaId)?.drive_folder_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline hover:text-green-900"
                      >
                        Open current folder <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setDriveOpen(false); resetDriveForm(); }}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                    onClick={onConnectDriveFolder}
                    disabled={driveConnecting || requiresIntake || !driveCriteriaId || !driveFolderUrl.trim()}
                  >
                    {driveConnecting ? "Connecting…" : "Connect Folder"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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

              {/* Criterion selector */}
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

              {/* Drop zone */}
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

              {/* Selected file list */}
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

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description / Context <span className="text-muted-foreground text-xs">(optional — applies to all files)</span></Label>
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
      </div>

      <AIOutputBanner variant="analysis" />

      {/* Tab switcher — Drive Files tab visible when folders are connected or being provisioned */}
      <div className="flex items-center gap-1 border-b mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "evidence"
              ? "border-[#1E2D6B] text-[#1E2D6B]"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Evidence Records
          {evidenceList && evidenceList.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({evidenceList.length})</span>
          )}
        </button>
        {(hasDriveFolders || isProvisioningDrive) && (
          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "drive"
                ? "border-[#1E2D6B] text-[#1E2D6B]"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            Drive Files
            {isProvisioningDrive && (
              <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#1E2D6B] animate-pulse ml-0.5" />
            )}
          </button>
        )}
      </div>

      {activeTab === "drive" ? (
        <DriveFileBrowser
          key={hasDriveFolders ? "folders-ready" : "no-folders"}
          fetchFn={clientDriveFetchFn}
          isProvisioning={isProvisioningDrive}
          justProvisioned={justProvisioned}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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
                            {evidence.primaryCriteriaId && (
                              <Badge variant="outline" className="text-xs font-mono">{evidence.primaryCriteriaId}</Badge>
                            )}
                            {evidence.source === "drive_ingest" && (
                              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <CloudDownload className="w-2.5 h-2.5" /> From Drive
                              </span>
                            )}
                          </div>
                          {evidence.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{evidence.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {evidence.fileName && <span className="truncate max-w-[200px]">{evidence.fileName}</span>}
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
    </AppLayout>
  );
}
