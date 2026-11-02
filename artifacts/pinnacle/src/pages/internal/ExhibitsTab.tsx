/**
 * ExhibitsTab.tsx — Pinnacle³
 *
 * Staff-facing Exhibits manager. The case's "Exhibits" Google Drive folder is
 * the source of truth: files uploaded from the app OR dropped directly in Drive
 * both appear here. Staff can create subfolders, upload, navigate the folder
 * tree, and "Send to client" (which shares the file, publishes it to the
 * client's Exhibits view, and notifies them).
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  Loader2, ExternalLink, FileText, Folder, FolderPlus, Upload,
  Send, Undo2, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── staffFetch ───────────────────────────────────────────────────────────────

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

// ─── Types ──────────────────────────────────────────────────────────────────

interface DriveFile {
  driveFileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  exhibitId: number | null;
  publishedToClient: boolean;
  publishedAt: string | null;
}
interface DriveFolder {
  driveFileId: string;
  name: string;
  webViewLink: string;
}
interface DriveListing {
  root: string;
  folderId: string;
  isRoot: boolean;
  subfolders: DriveFolder[];
  files: DriveFile[];
}
interface Crumb { id: string; name: string }

// ─── FileRow ──────────────────────────────────────────────────────────────────

function FileRow({
  file, onSend, onRecall, busy,
}: {
  file: DriveFile;
  onSend: (f: DriveFile) => void;
  onRecall: (f: DriveFile) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-gray-50/60 transition-colors group">
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {file.publishedToClient && file.publishedAt && (
          <p className="text-xs text-muted-foreground">
            Sent {new Date(file.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full border font-medium",
          file.publishedToClient
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-gray-100 text-gray-500 border-gray-200",
        )}>
          {file.publishedToClient ? "Visible to Client" : "Not sent"}
        </span>
        {file.webViewLink && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Open in Drive"
            onClick={() => window.open(file.webViewLink, "_blank")}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        {file.publishedToClient ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
            disabled={busy} onClick={() => onRecall(file)} title="Recall from client">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Undo2 className="w-3 h-3 mr-1" />Recall</>}
          </Button>
        ) : (
          <Button size="sm" className="h-7 text-xs bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white"
            disabled={busy} onClick={() => onSend(file)}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Send to client</>}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── ExhibitsTab (main export) ────────────────────────────────────────────────

export function ExhibitsTab({ userId }: { userId: string; profileData?: any }) {
  const [caseSetupId, setCaseSetupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCase, setNoCase] = useState(false);
  const [noFolder, setNoFolder] = useState(false);

  const [listing, setListing] = useState<DriveListing | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  const [upFile, setUpFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const currentFolderId = crumbs.length ? crumbs[crumbs.length - 1].id : null;

  // ── Load the case id ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await staffFetch(`/internal/petition/setup/${userId}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const first = d.cases?.[0];
        if (!first?.setup) { setNoCase(true); return; }
        setCaseSetupId(first.setup.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Load a Drive folder listing ───────────────────────────────────────────
  const loadFolder = useCallback(async (csId: number, folderId: string | null) => {
    setRefreshing(true);
    try {
      const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const r = await staffFetch(`/cases/${csId}/exhibits/drive${qs}`);
      if (r.status === 400) { setNoFolder(true); setListing(null); return; }
      if (!r.ok) { setMsg("Could not load the Exhibits folder."); return; }
      setNoFolder(false);
      const d: DriveListing = await r.json();
      setListing(d);
    } catch {
      setMsg("Could not load the Exhibits folder.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (caseSetupId) loadFolder(caseSetupId, currentFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseSetupId, currentFolderId]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const enterFolder = (f: DriveFolder) => setCrumbs((c) => [...c, { id: f.driveFileId, name: f.name }]);
  const goToCrumb = (idx: number) => setCrumbs((c) => (idx < 0 ? [] : c.slice(0, idx + 1)));

  // ── Upload ────────────────────────────────────────────────────────────────
  const doUpload = async () => {
    if (!upFile || !caseSetupId) return;
    setUploading(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", upFile);
      if (currentFolderId) fd.append("folderId", currentFolderId);
      const r = await staffFetch(`/cases/${caseSetupId}/exhibits/upload`, { method: "POST", body: fd });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? "Upload failed"); return; }
      setUpFile(null);
      setMsg("Uploaded. Click Send to client when you're ready to share it.");
      await loadFolder(caseSetupId, currentFolderId);
    } catch { setMsg("Upload failed"); } finally { setUploading(false); }
  };

  // ── Create folder ─────────────────────────────────────────────────────────
  const doCreateFolder = async () => {
    if (!newFolderName.trim() || !caseSetupId) return;
    setCreatingFolder(true); setMsg(null);
    try {
      const r = await staffFetch(`/cases/${caseSetupId}/exhibits/folder`, {
        method: "POST",
        body: JSON.stringify({ name: newFolderName.trim(), ...(currentFolderId ? { parentId: currentFolderId } : {}) }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? "Could not create folder"); return; }
      setNewFolderName(""); setShowNewFolder(false);
      await loadFolder(caseSetupId, currentFolderId);
    } catch { setMsg("Could not create folder"); } finally { setCreatingFolder(false); }
  };

  // ── Send / Recall ─────────────────────────────────────────────────────────
  const sendToClient = async (f: DriveFile) => {
    if (!caseSetupId) return;
    setRowBusy((p) => ({ ...p, [f.driveFileId]: true }));
    setMsg(null);
    try {
      const r = await staffFetch(`/cases/${caseSetupId}/exhibits/send-to-client`, {
        method: "POST",
        body: JSON.stringify({ driveFileId: f.driveFileId, fileName: f.name, webViewLink: f.webViewLink }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? "Could not send to client"); return; }
      setMsg(`“${f.name}” sent — the client has been notified.`);
      await loadFolder(caseSetupId, currentFolderId);
    } catch { setMsg("Could not send to client"); } finally {
      setRowBusy((p) => ({ ...p, [f.driveFileId]: false }));
    }
  };

  const recall = async (f: DriveFile) => {
    if (!caseSetupId) return;
    setRowBusy((p) => ({ ...p, [f.driveFileId]: true }));
    setMsg(null);
    try {
      const r = await staffFetch(`/cases/${caseSetupId}/exhibits/recall`, {
        method: "POST",
        body: JSON.stringify({ driveFileId: f.driveFileId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? "Could not recall"); return; }
      await loadFolder(caseSetupId, currentFolderId);
    } catch { setMsg("Could not recall"); } finally {
      setRowBusy((p) => ({ ...p, [f.driveFileId]: false }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (noCase || !caseSetupId) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-muted-foreground text-sm">No petition setup found. Create one in the Petition Workspace tab first.</p>
        </CardContent>
      </Card>
    );
  }

  if (noFolder) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-muted-foreground text-sm">This case has no Exhibits Drive folder yet. Create the case's Drive folders first (Drive Folders tab).</p>
        </CardContent>
      </Card>
    );
  }

  const files = listing?.files ?? [];
  const subfolders = listing?.subfolders ?? [];
  const sentCount = files.filter((f) => f.publishedToClient).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm min-w-0 flex-1">
            <button className="font-medium text-[#1E2D6B] hover:underline" onClick={() => goToCrumb(-1)}>
              Exhibits
            </button>
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <button
                  className={cn("truncate", i === crumbs.length - 1 ? "text-foreground font-medium" : "text-[#1E2D6B] hover:underline")}
                  onClick={() => goToCrumb(i)}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowNewFolder((s) => !s)}>
              <FolderPlus className="w-3.5 h-3.5 mr-1.5" />New Folder
            </Button>
            <label className="inline-flex">
              <input type="file" className="hidden"
                onChange={(e) => setUpFile(e.target.files?.[0] ?? null)} />
              <span className="inline-flex items-center h-8 px-3 text-xs border rounded-md cursor-pointer hover:bg-gray-50">
                <Upload className="w-3.5 h-3.5 mr-1.5" />{upFile ? "Change file" : "Choose file"}
              </span>
            </label>
            {upFile && (
              <Button size="sm" className="h-8 text-xs bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white"
                disabled={uploading} onClick={doUpload}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                Upload{upFile ? ` “${upFile.name.length > 18 ? upFile.name.slice(0, 18) + "…" : upFile.name}”` : ""}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Refresh"
              disabled={refreshing} onClick={() => caseSetupId && loadFolder(caseSetupId, currentFolderId)}>
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </Button>
            {listing && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" title="Open folder in Drive"
                onClick={() => window.open(`https://drive.google.com/drive/folders/${listing.folderId}`, "_blank")}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" />Drive
              </Button>
            )}
          </div>

          {showNewFolder && (
            <div className="w-full flex items-center gap-2 pt-2">
              <input
                autoFocus type="text" value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doCreateFolder(); if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }}
                placeholder="Folder name"
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
              <Button size="sm" className="h-8 text-xs bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white"
                disabled={!newFolderName.trim() || creatingFolder} onClick={doCreateFolder}>
                {creatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>Cancel</Button>
            </div>
          )}

          {msg && (
            <div className="w-full flex items-center gap-1.5 pt-1 text-xs text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{msg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listing */}
      <Card>
        <CardContent className="p-0">
          {subfolders.length === 0 && files.length === 0 ? (
            <div className="py-12 text-center">
              <Folder className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">This folder is empty.</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a file here, or add one directly in Google Drive — it'll show up on refresh.</p>
            </div>
          ) : (
            <>
              {/* Subfolders */}
              {subfolders.map((f) => (
                <button key={f.driveFileId}
                  className="w-full flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => enterFolder(f)}>
                  <Folder className="w-4 h-4 text-[#1E2D6B] shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{f.name}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
              {/* Files */}
              {files.map((f) => (
                <FileRow key={f.driveFileId} file={f}
                  onSend={sendToClient} onRecall={recall} busy={!!rowBusy[f.driveFileId]} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {files.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {files.length} file{files.length !== 1 ? "s" : ""} in this folder · {sentCount} visible to client
        </p>
      )}
    </div>
  );
}
