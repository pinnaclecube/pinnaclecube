/**
 * FolderBrowser.tsx — Pinnacle³
 *
 * Shared folder-and-file browser for Drive-backed case folders.
 *
 * Features:
 * - Two-panel layout: collapsible folder tree (left) + file list (right)
 * - All reads hit the DB via the API — no live Drive calls per click
 * - Real-time updates via SSE (drive_sync events from Drive webhook)
 *   Uses fetch() + ReadableStream instead of EventSource so custom auth
 *   headers (Bearer JWT / X-Staff-Token) are forwarded via fetchFn
 * - Staff view: uploader label column, staff-only folder indicators + toggle
 * - Client view: staff-only folders are filtered server-side
 * - Breadcrumb path in right panel header
 * - Source badges (App / Drive / Staff) on every file row
 * - Drag-and-drop + click-to-upload
 * - New Folder modal (staff can mark as staff-only at creation time)
 * - Criteria folders show upload guidance card (dismissible per folder)
 */

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Folder, FolderOpen, FolderPlus, Upload, File, FileText,
  ExternalLink, Loader2, ChevronRight, ChevronDown, AlertCircle,
  X, ShieldCheck, RefreshCw, Lock, ImageIcon, Info, Clipboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseFolder {
  id: number;
  name: string;
  folderType: string;
  driveUrl: string;
  parentFolderId: number | null;
  staffOnly: boolean;
  legalStandard: string | null;
  uploadGuidance: string | null;
  criteriaCode: string | null;
  children?: CaseFolder[];
}

interface CaseFolderItem {
  id: number;
  caseFolderId: number;
  driveId: string;
  name: string;
  mimeType: string;
  driveUrl: string;
  addedBySource: "app" | "drive" | "staff";
  addedByLabel: string | null;
  createdAt: string;
}

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

interface FolderBrowserProps {
  caseId: number;
  fetchFn: FetchFn;
  isStaff?: boolean;
  readOnly?: boolean;
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(folders: CaseFolder[], parentId: number | null = null): CaseFolder[] {
  return folders
    .filter((f) => f.parentFolderId === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }));
}

// ─── Breadcrumb builder ────────────────────────────────────────────────────────

function buildBreadcrumb(folders: CaseFolder[], folderId: number): CaseFolder[] {
  const map = new Map(folders.map((f) => [f.id, f]));
  const path: CaseFolder[] = [];
  let current: CaseFolder | undefined = map.get(folderId);
  while (current) {
    path.unshift(current);
    current = current.parentFolderId != null ? map.get(current.parentFolderId) : undefined;
  }
  return path;
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: "app" | "drive" | "staff" }) {
  if (source === "drive") {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap leading-none">
        Drive
      </span>
    );
  }
  if (source === "staff") {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap leading-none">
        Staff
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-[#3D4FA8] border border-indigo-200 whitespace-nowrap leading-none">
      App
    </span>
  );
}

// ─── Folder icon by type ──────────────────────────────────────────────────────

function FolderTypeIcon({ type, open }: { type: string; open: boolean }) {
  const cls = "w-4 h-4 shrink-0";
  if (type === "root") {
    return open
      ? <FolderOpen className={cn(cls, "text-[#1E2D6B]")} />
      : <Folder className={cn(cls, "text-[#1E2D6B]")} />;
  }
  if (type === "evidence") {
    return open
      ? <FolderOpen className={cn(cls, "text-amber-600")} />
      : <Folder className={cn(cls, "text-amber-600")} />;
  }
  if (type === "criteria") {
    return open
      ? <FolderOpen className={cn(cls, "text-violet-500")} />
      : <Folder className={cn(cls, "text-violet-500")} />;
  }
  if (type === "custom") {
    return open
      ? <FolderOpen className={cn(cls, "text-indigo-400")} />
      : <Folder className={cn(cls, "text-indigo-400")} />;
  }
  return open
    ? <FolderOpen className={cn(cls, "text-gray-400")} />
    : <Folder className={cn(cls, "text-gray-400")} />;
}

// ─── Mime icon ────────────────────────────────────────────────────────────────

function MimeIcon({ mimeType }: { mimeType: string }) {
  const cls = "w-4 h-4 shrink-0";
  if (mimeType === "application/pdf")
    return <FileText className={cn(cls, "text-red-500")} />;
  if (mimeType.startsWith("image/"))
    return <ImageIcon className={cn(cls, "text-green-500")} />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className={cn(cls, "text-blue-500")} />;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return <FileText className={cn(cls, "text-emerald-600")} />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <FileText className={cn(cls, "text-orange-500")} />;
  if (mimeType.startsWith("text/"))
    return <FileText className={cn(cls, "text-gray-500")} />;
  return <File className={cn(cls, "text-gray-400")} />;
}

// Note: real-time updates were previously delivered via an SSE stream
// (/drive/events) pushed from the Drive webhook. That path cannot work on
// serverless (no long-lived connections, no reliable post-response work), so
// the browser now live-syncs the open folder from Drive on open / poll / manual
// refresh instead — see syncFolder() in FolderBrowser below.

// ─── Guidance card ────────────────────────────────────────────────────────────

interface GuidanceCardProps {
  folder: CaseFolder;
  dismissed: boolean;
  collapsed: boolean;
  onDismiss: () => void;
  onToggleCollapse: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

function GuidanceCard({
  folder, dismissed, collapsed, onDismiss, onToggleCollapse, cardRef,
}: GuidanceCardProps) {
  if (dismissed || !folder.uploadGuidance) return null;

  return (
    <div
      ref={cardRef}
      className="mx-4 mt-3 rounded-lg border border-violet-100 bg-violet-50 overflow-hidden"
    >
      {/* Card header — clickable to collapse */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left group"
      >
        <div className="flex items-center gap-2">
          <Clipboard className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="text-sm font-semibold text-violet-700">What to upload here</span>
        </div>
        <div className="flex items-center gap-1.5">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-violet-400 group-hover:text-violet-600 transition-colors" />
            : <ChevronDown className="w-3.5 h-3.5 text-violet-400 group-hover:text-violet-600 transition-colors" />}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="p-0.5 rounded hover:bg-violet-100 transition-colors text-violet-400 hover:text-violet-600"
            title="Dismiss"
            aria-label="Dismiss guidance"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </button>

      {/* Card body — collapsible */}
      {!collapsed && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <p className="text-sm text-gray-700 leading-relaxed">
            {folder.uploadGuidance}
          </p>
          {folder.legalStandard && (
            <div className="pt-2 border-t border-violet-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Legal standard
              </p>
              <p className="text-xs text-gray-500 italic leading-relaxed">
                {folder.legalStandard}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tree node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: CaseFolder;
  depth: number;
  selectedId: number | null;
  onSelect: (f: CaseFolder) => void;
  expandedIds: Set<number>;
  toggleExpanded: (id: number) => void;
  isStaff: boolean;
  onToggleStaffOnly: (f: CaseFolder) => void;
  onScrollToGuidance: () => void;
}

function TreeNode({
  node, depth, selectedId, onSelect, expandedIds,
  toggleExpanded, isStaff, onToggleStaffOnly, onScrollToGuidance,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const showGuidanceBadge = isSelected && node.folderType === "criteria" && !!node.uploadGuidance;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 pr-1 rounded-md transition-colors",
          isSelected ? "bg-[#1E2D6B]/10" : "hover:bg-gray-100",
        )}
      >
        <button
          onClick={() => {
            onSelect(node);
            if (hasChildren) toggleExpanded(node.id);
          }}
          className={cn(
            "flex-1 flex items-center gap-1.5 py-1.5 text-left text-sm min-w-0",
            isSelected ? "text-[#1E2D6B] font-medium" : "text-gray-700",
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="shrink-0 w-3.5">
            {hasChildren ? (
              isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            ) : null}
          </span>
          <FolderTypeIcon type={node.folderType} open={isSelected || isExpanded} />
          <span className="truncate">{node.name}</span>
        </button>

        {/* Staff-only lock icon (always visible when folder is locked) */}
        {node.staffOnly && (
          <span title="Staff-only — hidden from client" className="shrink-0 flex items-center">
            <Lock className="w-3 h-3 text-amber-500" />
          </span>
        )}

        {/* Staff: hover toggle button for non-root folders */}
        {isStaff && node.folderType !== "root" && (
          <button
            onClick={() => onToggleStaffOnly(node)}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0",
              node.staffOnly
                ? "text-amber-500 hover:text-gray-400"
                : "text-gray-300 hover:text-amber-500",
            )}
            title={node.staffOnly ? "Make visible to client" : "Make staff-only"}
          >
            <ShieldCheck className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* "What to upload" badge — shown for selected criteria folders with guidance */}
      {showGuidanceBadge && (
        <button
          onClick={onScrollToGuidance}
          className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 transition-colors py-0.5 w-full"
          style={{ paddingLeft: `${8 + depth * 16 + 20}px` }}
        >
          <Info className="w-2.5 h-2.5 shrink-0" />
          <span>What to upload</span>
        </button>
      )}

      {isExpanded && hasChildren && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          toggleExpanded={toggleExpanded}
          isStaff={isStaff}
          onToggleStaffOnly={onToggleStaffOnly}
          onScrollToGuidance={onScrollToGuidance}
        />
      ))}
    </div>
  );
}

// ─── Main FolderBrowser ───────────────────────────────────────────────────────

export function FolderBrowser({ caseId, fetchFn, isStaff = false, readOnly = false }: FolderBrowserProps) {
  const [folders, setFolders] = useState<CaseFolder[]>([]);
  const [tree, setTree] = useState<CaseFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CaseFolder | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<CaseFolder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<CaseFolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Guidance card state — tracked per folder ID
  const [dismissedFolderIds, setDismissedFolderIds] = useState<Set<number>>(new Set());
  const [collapsedGuidanceIds, setCollapsedGuidanceIds] = useState<Set<number>>(new Set());
  const guidanceRef = useRef<HTMLDivElement>(null);

  // New folder modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderStaffOnly, setNewFolderStaffOnly] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep a ref to selected folder so SSE handler can access it without stale closure
  const selectedFolderRef = useRef<CaseFolder | null>(null);
  useEffect(() => { selectedFolderRef.current = selectedFolder; }, [selectedFolder]);

  // ─── Guidance helpers ──────────────────────────────────────────────────────

  const scrollToGuidance = useCallback(() => {
    guidanceRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleDismissGuidance = useCallback((folderId: number) => {
    setDismissedFolderIds((prev) => new Set([...prev, folderId]));
  }, []);

  const handleToggleGuidanceCollapse = useCallback((folderId: number) => {
    setCollapsedGuidanceIds((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  }, []);

  // ─── Breadcrumb ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedFolder) { setBreadcrumb([]); return; }
    setBreadcrumb(buildBreadcrumb(folders, selectedFolder.id));
  }, [selectedFolder, folders]);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadFolders = useCallback(async (preserveSelection = false) => {
    if (!preserveSelection) setLoadingFolders(true);
    setFolderError(null);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders`);
      if (!r.ok) throw new Error("Failed to load folders");
      const data = await r.json() as { folders: CaseFolder[] };
      setFolders(data.folders);
      setTree(buildTree(data.folders));

      if (!preserveSelection) {
        const root = data.folders.find((f) => f.parentFolderId === null);
        if (root) {
          setExpandedIds(new Set([root.id]));
          setSelectedFolder(root);
        }
      } else {
        const prev = selectedFolderRef.current;
        if (prev) {
          const refreshed = data.folders.find((f) => f.id === prev.id);
          if (refreshed) setSelectedFolder(refreshed);
        }
      }
    } catch {
      setFolderError("Could not load folders. Please try again.");
    } finally {
      setLoadingFolders(false);
    }
  }, [caseId, fetchFn]);

  useEffect(() => { void loadFolders(); }, [loadFolders]);

  const loadFiles = useCallback(async (folder: CaseFolder) => {
    setLoadingFiles(true);
    setUploadError(null);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders/${folder.id}/files`);
      if (!r.ok) throw new Error("Failed to load files");
      const data = await r.json() as { items: CaseFolderItem[] };
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [caseId, fetchFn]);

  // Live-sync the open folder from Drive, then refetch the tree (new subfolders)
  // and the file list (new files). This is what surfaces content uploaded
  // directly into Google Drive. Guarded so overlapping syncs don't stack up.
  const syncInFlightRef = useRef(false);

  const syncFolder = useCallback(async (folder: CaseFolder) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders/${folder.id}/sync`, {
        method: "POST",
      });
      if (r.ok) {
        await loadFolders(true);
        const sel = selectedFolderRef.current;
        if (sel) await loadFiles(sel);
        setLastSyncAt(new Date());
      }
    } catch {
      // Network/Drive error — keep showing the cached contents
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [caseId, fetchFn, loadFolders, loadFiles]);

  const handleSelectFolder = useCallback((folder: CaseFolder) => {
    setSelectedFolder(folder);
    void loadFiles(folder);   // show cached contents instantly
    void syncFolder(folder);  // then refresh from Drive in the background
  }, [loadFiles, syncFolder]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ─── Background polling ─────────────────────────────────────────────────────
  // Poll the open folder so files/subfolders added directly in Google Drive
  // appear without a manual refresh. Only runs while the tab is visible to keep
  // Drive API usage modest.

  useEffect(() => {
    const POLL_MS = 30_000;
    const id = setInterval(() => {
      const sel = selectedFolderRef.current;
      if (sel && document.visibilityState === "visible") void syncFolder(sel);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [syncFolder]);

  // ─── New Folder helpers ────────────────────────────────────────────────────

  const openNewFolderModal = useCallback(() => {
    setNewFolderName("");
    setNewFolderStaffOnly(false);
    setFolderCreateError(null);
    setShowNewFolderModal(true);
  }, []);

  // ─── Folder actions ────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedFolder) return;
    setCreatingFolder(true);
    setFolderCreateError(null);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentFolderId: selectedFolder.id,
          name: newFolderName.trim(),
          staffOnly: isStaff ? newFolderStaffOnly : false,
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error: string };
        throw new Error(d.error ?? "Failed to create folder");
      }
      setShowNewFolderModal(false);
      setNewFolderName("");
      setNewFolderStaffOnly(false);
      await loadFolders(true);
    } catch (err) {
      setFolderCreateError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleToggleStaffOnly = async (folder: CaseFolder) => {
    try {
      await fetchFn(`/cases/${caseId}/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffOnly: !folder.staffOnly }),
      });
      await loadFolders(true);
    } catch {
      // Silently swallow — tree will reflect correct state after reload
    }
  };

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !selectedFolder) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const form = new FormData();
        form.append("file", file);
        const r = await fetchFn(`/cases/${caseId}/folders/${selectedFolder.id}/files`, {
          method: "POST",
          body: form,
        });
        if (!r.ok) {
          const d = await r.json() as { error?: string };
          throw new Error(d.error ?? "Upload failed");
        }
      }
      await loadFiles(selectedFolder);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleUpload(e.dataTransfer.files);
  };

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loadingFolders) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" />
      </div>
    );
  }

  if (folderError) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <p className="text-sm">{folderError}</p>
        <Button size="sm" variant="outline" onClick={() => void loadFolders()} className="ml-auto">
          Retry
        </Button>
      </div>
    );
  }

  // Derived guidance card state for selected folder
  const showGuidanceCard = !!(
    selectedFolder?.folderType === "criteria" &&
    selectedFolder.uploadGuidance &&
    !dismissedFolderIds.has(selectedFolder.id)
  );
  const guidanceCollapsed = !!(selectedFolder && collapsedGuidanceIds.has(selectedFolder.id));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-white">

      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs text-muted-foreground">
        <RefreshCw className={cn("w-3 h-3 shrink-0", syncing && "animate-spin")} />
        <span>{syncing ? "Syncing with Google Drive…" : "Synced with Google Drive"}</span>
        {lastSyncAt && (
          <span className="text-[#1E2D6B] font-medium">
            · Updated {lastSyncAt.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={() => { const s = selectedFolderRef.current; if (s) void syncFolder(s); }}
          disabled={syncing || !selectedFolder}
          className="ml-2 inline-flex items-center gap-1 font-medium text-[#1E2D6B] hover:text-[#3D4FA8] disabled:opacity-40 disabled:cursor-not-allowed"
          title="Check Google Drive for new files now"
        >
          Refresh
        </button>
        {isStaff && (
          <span className="ml-auto flex items-center gap-1 text-amber-600 font-medium">
            <ShieldCheck className="w-3 h-3" />
            Staff view
          </span>
        )}
      </div>

      <div className="flex min-h-[560px]">

        {/* ── Left: Folder tree ─────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-r bg-gray-50 flex flex-col">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Folders
            </span>
            {!readOnly && selectedFolder && (
              <button
                onClick={openNewFolderModal}
                className="text-[#1E2D6B] hover:text-[#3D4FA8] transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedFolder?.id ?? null}
                onSelect={handleSelectFolder}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                isStaff={isStaff}
                onToggleStaffOnly={handleToggleStaffOnly}
                onScrollToGuidance={scrollToGuidance}
              />
            ))}
          </div>

          {isStaff && (
            <div className="px-3 py-2 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" />
                Hover a folder to toggle staff-only
              </p>
            </div>
          )}
        </div>

        {/* ── Right: File list ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* File panel header */}
          <div className="px-4 pt-2.5 pb-2 border-b bg-white">
            {/* Breadcrumb — hidden for root-level selection */}
            {breadcrumb.length > 1 && (
              <div className="flex items-center gap-0.5 mb-1.5 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap">
                {breadcrumb.slice(0, -1).map((crumb, i) => (
                  <Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-gray-300" />}
                    <button
                      className="hover:text-[#1E2D6B] transition-colors truncate max-w-[140px] px-0.5"
                      onClick={() => handleSelectFolder(crumb)}
                      title={crumb.name}
                    >
                      {crumb.name}
                    </button>
                  </Fragment>
                ))}
                <ChevronRight className="w-3 h-3 shrink-0 text-gray-300" />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {selectedFolder && (
                  <FolderTypeIcon type={selectedFolder.folderType} open />
                )}
                <span className="text-sm font-semibold truncate text-gray-900">
                  {selectedFolder?.name ?? "Select a folder"}
                </span>
                {selectedFolder?.staffOnly && (
                  <Badge
                    variant="outline"
                    className="text-xs h-4 px-1.5 border-amber-300 text-amber-700 bg-amber-50 shrink-0"
                  >
                    Staff only
                  </Badge>
                )}
                {selectedFolder?.driveUrl && (
                  <a
                    href={selectedFolder.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-[#1E2D6B] transition-colors shrink-0"
                    title="Open folder in Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {!readOnly && selectedFolder && (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={openNewFolderModal}
                  >
                    <FolderPlus className="w-3 h-3" />
                    New Folder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Upload className="w-3 h-3" />}
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleUpload(e.target.files)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Upload error banner */}
          {uploadError && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-auto">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Guidance card — criteria folders only */}
          {showGuidanceCard && selectedFolder && (
            <GuidanceCard
              folder={selectedFolder}
              dismissed={false}
              collapsed={guidanceCollapsed}
              onDismiss={() => handleDismissGuidance(selectedFolder.id)}
              onToggleCollapse={() => handleToggleGuidanceCollapse(selectedFolder.id)}
              cardRef={guidanceRef as React.RefObject<HTMLDivElement>}
            />
          )}

          {/* Drop zone + file list */}
          <div
            className={cn(
              "flex-1 overflow-y-auto transition-colors",
              isDragging && !readOnly
                ? "bg-[#1E2D6B]/5 ring-2 ring-inset ring-[#1E2D6B]/30"
                : "",
            )}
            onDragOver={!readOnly ? handleDragOver : undefined}
            onDragLeave={!readOnly ? handleDragLeave : undefined}
            onDrop={!readOnly ? handleDrop : undefined}
          >
            {!selectedFolder ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                <Folder className="w-10 h-10 mb-2 text-gray-200" />
                <p className="text-sm">Select a folder to view its files</p>
              </div>

            ) : loadingFiles ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-[#1E2D6B]" />
              </div>

            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                {isDragging ? (
                  <>
                    <Upload className="w-10 h-10 mb-2 text-[#1E2D6B]/50" />
                    <p className="text-sm font-medium text-[#1E2D6B]">Drop files to upload</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">No documents uploaded yet</p>
                    {!readOnly && (
                      <p className="text-xs mt-1 text-gray-400 max-w-xs">
                        {selectedFolder.folderType === "criteria"
                          ? "Use the Upload button above to add documents for this criterion."
                          : <>Click <span className="font-medium text-gray-500">Upload</span> or drag &amp; drop files here</>}
                      </p>
                    )}
                    {/* Show guidance inline in empty state when card was dismissed */}
                    {selectedFolder.folderType === "criteria" &&
                      selectedFolder.uploadGuidance &&
                      dismissedFolderIds.has(selectedFolder.id) && (
                      <div className="mt-4 max-w-sm text-left rounded-lg border border-violet-100 bg-violet-50 px-3.5 py-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Clipboard className="w-3 h-3 text-violet-400 shrink-0" />
                          <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">
                            What to upload
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {selectedFolder.uploadGuidance}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

            ) : (
              <div className="flex flex-col">

                {/* Drop-while-dragging overlay strip */}
                {isDragging && !readOnly && (
                  <div className="flex items-center justify-center gap-2 h-10 bg-[#1E2D6B]/8 text-[#1E2D6B] text-sm font-medium border-b">
                    <Upload className="w-4 h-4" />
                    Drop to upload here
                  </div>
                )}

                {/* Column headers — staff only */}
                {isStaff && (
                  <div className="grid grid-cols-[20px_1fr_180px_88px_36px] gap-3 items-center px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span />
                    <span>Name</span>
                    <span>Source</span>
                    <span>Date</span>
                    <span />
                  </div>
                )}

                {/* File rows */}
                {items.map((item) =>
                  isStaff ? (
                    /* ── Staff row ── */
                    <div
                      key={item.id}
                      className="grid grid-cols-[20px_1fr_180px_88px_36px] gap-3 items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                    >
                      <MimeIcon mimeType={item.mimeType} />
                      <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SourceBadge source={item.addedBySource} />
                        <span className="text-xs text-muted-foreground truncate">
                          {item.addedBySource === "drive"
                            ? "sync"
                            : (item.addedByLabel ?? "")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center text-gray-400 hover:text-[#1E2D6B] transition-colors"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    /* ── Client row ── */
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                    >
                      <MimeIcon mimeType={item.mimeType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <SourceBadge source={item.addedBySource} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-[#1E2D6B] transition-colors shrink-0"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── New Folder Modal ── */}
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Creating inside:{" "}
                <span className="text-gray-800">{selectedFolder?.name}</span>
              </label>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFolder(); }}
                autoFocus
              />
            </div>

            {isStaff && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newFolderStaffOnly}
                  onChange={(e) => setNewFolderStaffOnly(e.target.checked)}
                  className="rounded border-gray-300 accent-amber-500"
                />
                <span className="font-medium text-gray-700">Staff-only folder</span>
                <span className="text-xs text-muted-foreground">(hidden from client)</span>
              </label>
            )}

            {folderCreateError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {folderCreateError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFolderModal(false)}
              disabled={creatingFolder}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateFolder()}
              disabled={!newFolderName.trim() || creatingFolder}
              className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
            >
              {creatingFolder
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : null}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
