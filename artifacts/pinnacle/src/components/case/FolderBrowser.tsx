/**
 * FolderBrowser.tsx — Pinnacle³
 *
 * Shared folder-and-file browser for Drive-backed case folders.
 * Accepts an authenticated fetch function so it works for both
 * client pages (Bearer JWT) and staff pages (X-Staff-Token).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Folder, FolderOpen, FolderPlus, Upload, File, ExternalLink,
  Loader2, ChevronRight, ChevronDown, AlertCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseFolder {
  id: number;
  name: string;
  folderType: string;
  driveUrl: string;
  parentFolderId: number | null;
  children?: CaseFolder[];
}

interface CaseFolderItem {
  id: number;
  caseFolderId: number;
  driveId: string;
  name: string;
  mimeType: string;
  driveUrl: string;
  addedBySource: "app" | "drive";
  createdAt: string;
}

interface FolderBrowserProps {
  caseId: number;
  fetchFn: (path: string, opts?: RequestInit) => Promise<Response>;
  readOnly?: boolean;
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(folders: CaseFolder[], parentId: number | null = null): CaseFolder[] {
  return folders
    .filter((f) => f.parentFolderId === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }));
}

// ─── Folder icon by type ──────────────────────────────────────────────────────

function folderIcon(type: string, open: boolean) {
  const cls = "w-4 h-4 shrink-0";
  if (type === "root") return open
    ? <FolderOpen className={cn(cls, "text-[#1E2D6B]")} />
    : <Folder className={cn(cls, "text-[#1E2D6B]")} />;
  if (type === "evidence") return open
    ? <FolderOpen className={cn(cls, "text-amber-600")} />
    : <Folder className={cn(cls, "text-amber-600")} />;
  if (type === "criteria" || type === "custom") return open
    ? <FolderOpen className={cn(cls, "text-indigo-500")} />
    : <Folder className={cn(cls, "text-indigo-500")} />;
  return open
    ? <FolderOpen className={cn(cls, "text-gray-500")} />
    : <Folder className={cn(cls, "text-gray-500")} />;
}

// ─── File mime icon ───────────────────────────────────────────────────────────

function mimeIcon(mimeType: string) {
  return <File className="w-4 h-4 text-gray-400 shrink-0" />;
}

// ─── Recursive folder tree node ───────────────────────────────────────────────

interface TreeNodeProps {
  node: CaseFolder;
  depth: number;
  selectedId: number | null;
  onSelect: (f: CaseFolder) => void;
  expandedIds: Set<number>;
  toggleExpanded: (id: number) => void;
}

function TreeNode({ node, depth, selectedId, onSelect, expandedIds, toggleExpanded }: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node);
          if (hasChildren) toggleExpanded(node.id);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm rounded-md transition-colors",
          isSelected ? "bg-[#1E2D6B]/10 text-[#1E2D6B] font-medium" : "text-gray-700 hover:bg-gray-100",
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
        {folderIcon(node.folderType, isSelected || isExpanded)}
        <span className="truncate">{node.name}</span>
      </button>

      {isExpanded && hasChildren && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          toggleExpanded={toggleExpanded}
        />
      ))}
    </div>
  );
}

// ─── Main FolderBrowser ───────────────────────────────────────────────────────

export function FolderBrowser({ caseId, fetchFn, readOnly = false }: FolderBrowserProps) {
  const [folders, setFolders] = useState<CaseFolder[]>([]);
  const [tree, setTree] = useState<CaseFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CaseFolder | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<CaseFolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // New folder modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load folders
  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    setFolderError(null);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders`);
      if (!r.ok) throw new Error("Failed to load folders");
      const data = await r.json() as { folders: CaseFolder[] };
      setFolders(data.folders);
      setTree(buildTree(data.folders));
      // Auto-expand root
      const root = data.folders.find((f) => f.parentFolderId === null);
      if (root) {
        setExpandedIds(new Set([root.id]));
        setSelectedFolder(root);
      }
    } catch {
      setFolderError("Could not load folders. Please try again.");
    } finally {
      setLoadingFolders(false);
    }
  }, [caseId, fetchFn]);

  useEffect(() => { void loadFolders(); }, [loadFolders]);

  // Load files for selected folder
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

  const handleSelectFolder = useCallback((folder: CaseFolder) => {
    setSelectedFolder(folder);
    void loadFiles(folder);
  }, [loadFiles]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Create subfolder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedFolder) return;
    setCreatingFolder(true);
    setFolderCreateError(null);
    try {
      const r = await fetchFn(`/cases/${caseId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolderId: selectedFolder.id, name: newFolderName.trim() }),
      });
      if (!r.ok) {
        const d = await r.json() as { error: string };
        throw new Error(d.error ?? "Failed to create folder");
      }
      setShowNewFolderModal(false);
      setNewFolderName("");
      await loadFolders();
    } catch (err) {
      setFolderCreateError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Upload file
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

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleUpload(e.dataTransfer.files);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
        <Button size="sm" variant="outline" onClick={loadFolders} className="ml-auto">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-0 border rounded-lg overflow-hidden bg-white min-h-[420px]">
      {/* ── Left: Folder Tree ── */}
      <div className="w-64 shrink-0 border-r bg-gray-50 flex flex-col">
        <div className="px-3 py-2.5 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</span>
          {!readOnly && selectedFolder && (
            <button
              onClick={() => { setNewFolderName(""); setFolderCreateError(null); setShowNewFolderModal(true); }}
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
            />
          ))}
        </div>
      </div>

      {/* ── Right: File List ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {selectedFolder && folderIcon(selectedFolder.folderType, true)}
            <span className="text-sm font-medium truncate text-gray-800">
              {selectedFolder?.name ?? "Select a folder"}
            </span>
            {selectedFolder?.driveUrl && (
              <a href={selectedFolder.driveUrl} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#1E2D6B] transition-colors shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {!readOnly && selectedFolder && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
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

        {/* Upload error */}
        {uploadError && (
          <div className="mx-4 mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Drag-drop zone + file list */}
        <div
          className={cn(
            "flex-1 p-4 overflow-y-auto transition-colors",
            isDragging && !readOnly ? "bg-[#1E2D6B]/5 ring-2 ring-inset ring-[#1E2D6B]/30" : "",
          )}
          onDragOver={!readOnly ? handleDragOver : undefined}
          onDragLeave={!readOnly ? handleDragLeave : undefined}
          onDrop={!readOnly ? handleDrop : undefined}
        >
          {!selectedFolder ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
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
                  <File className="w-10 h-10 mb-2 text-gray-200" />
                  <p className="text-sm">No files yet</p>
                  {!readOnly && <p className="text-xs mt-1">Upload files or drag &amp; drop them here</p>}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {isDragging && !readOnly && (
                <div className="flex items-center justify-center h-16 border-2 border-dashed border-[#1E2D6B]/30 rounded-lg mb-2 text-[#1E2D6B] text-sm font-medium gap-2">
                  <Upload className="w-4 h-4" /> Drop to upload here
                </div>
              )}
              {items.map((item) => (
                <div key={item.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
                  {mimeIcon(item.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.addedBySource === "drive" ? "Added via Drive" : "Uploaded in app"}
                      {" · "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a href={item.driveUrl} target="_blank" rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#1E2D6B] shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
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
                Creating inside: <span className="text-gray-800">{selectedFolder?.name}</span>
              </label>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFolder(); }}
                autoFocus
              />
            </div>
            {folderCreateError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />{folderCreateError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderModal(false)} disabled={creatingFolder}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateFolder()}
              disabled={!newFolderName.trim() || creatingFolder}
              className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
            >
              {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
