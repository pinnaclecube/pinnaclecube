import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, FileImage, File, FolderOpen, Folder,
  ExternalLink, Eye, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, Loader2, HardDriveDownload, CheckCircle2,
  FolderPlus, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DrivePreviewModal } from "./DrivePreviewModal";

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

export interface DriveSubfolder {
  id: string;
  name: string;
  files: DriveFileItem[];
  error?: string;
}

export interface DriveCriteriaFolder {
  criteriaId: string;
  criteriaName: string;
  folderName: string;
  driveFolderId: string;
  driveFolderUrl: string | null;
  files: DriveFileItem[];
  subfolders: DriveSubfolder[];
  error?: string;
}

export type CreateFolderFn = (opts: { name: string; parentDriveId: string }) => Promise<void>;

interface DriveFileBrowserProps {
  fetchFn: () => Promise<{ criteria: DriveCriteriaFolder[] }>;
  createFolderFn?: CreateFolderFn;
  isProvisioning?: boolean;
  justProvisioned?: boolean;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
  if (mimeType === "application/pdf") return <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (mimeType.startsWith("application/vnd.google-apps.document")) return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  if (mimeType.startsWith("application/vnd.google-apps.spreadsheet")) return <FileText className="w-3.5 h-3.5 text-green-600 shrink-0" />;
  if (mimeType.startsWith("application/vnd.google-apps.presentation")) return <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/vnd.google-apps.document") return "Doc";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Sheet";
  if (mimeType === "application/vnd.google-apps.presentation") return "Slides";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Excel";
  return "File";
}

function formatSize(size: string | null): string {
  if (!size) return "";
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Inline "New Folder" input ────────────────────────────────────────────────

interface NewFolderRowProps {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}

function NewFolderRow({ onCreate, onCancel }: NewFolderRowProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(trimmed);
      onCancel();
    } catch (err: any) {
      setError(err.message ?? "Failed to create folder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <FolderPlus className="w-3.5 h-3.5 text-[#1E2D6B] shrink-0" />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Folder name…"
          disabled={saving}
          className="flex-1 text-xs bg-white border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1 text-xs font-medium text-white bg-[#1E2D6B] hover:bg-[#3D4FA8] disabled:opacity-50 px-2 py-1 rounded transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1 pl-6">{error}</p>}
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DriveFileItem;
  onPreview: (file: DriveFileItem) => void;
  indent?: boolean;
}

function FileRow({ file, onPreview, indent }: FileRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors group text-xs",
      indent && "pl-8"
    )}>
      {fileIcon(file.mimeType)}
      <span className="flex-1 min-w-0 font-medium truncate" title={file.name}>
        {file.name}
      </span>
      <span className="text-muted-foreground shrink-0 hidden sm:block">
        {fileTypeLabel(file.mimeType)}
      </span>
      {file.size && (
        <span className="text-muted-foreground shrink-0 hidden md:block w-16 text-right">
          {formatSize(file.size)}
        </span>
      )}
      {file.modifiedTime && (
        <span className="text-muted-foreground shrink-0 hidden lg:block w-24 text-right">
          {formatDate(file.modifiedTime)}
        </span>
      )}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => onPreview(file)}
          title="Preview"
        >
          <Eye className="w-3 h-3" /> Preview
        </Button>
        <a
          href={file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" title="Open in Drive">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      </div>
    </div>
  );
}

// ─── Subfolder section ────────────────────────────────────────────────────────

interface SubfolderSectionProps {
  subfolder: DriveSubfolder;
  onPreview: (file: DriveFileItem) => void;
  onCreateFolder?: (name: string) => Promise<void>;
}

function SubfolderSection({ subfolder, onPreview, onCreateFolder }: SubfolderSectionProps) {
  const [open, setOpen] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);

  return (
    <div className="border-t border-dashed border-gray-200">
      <div className="flex items-center gap-0">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <span className="font-medium flex-1 truncate">{subfolder.name}</span>
          <span className="text-muted-foreground mr-1">{subfolder.files.length} file{subfolder.files.length !== 1 ? "s" : ""}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        </button>

        {onCreateFolder && open && !showNewFolder && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowNewFolder(true); }}
            className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-[#1E2D6B] transition-colors"
            title="New subfolder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <>
          {subfolder.error && (
            <div className="flex items-center gap-2 px-8 py-2 text-xs text-amber-700 bg-amber-50">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {subfolder.error}
            </div>
          )}
          {subfolder.files.length === 0 && !subfolder.error && !showNewFolder && (
            <p className="px-8 py-2 text-xs text-muted-foreground italic">No files in this folder.</p>
          )}
          {subfolder.files.map((file) => (
            <FileRow key={file.id} file={file} onPreview={onPreview} indent />
          ))}
          {showNewFolder && onCreateFolder && (
            <NewFolderRow
              onCreate={onCreateFolder}
              onCancel={() => setShowNewFolder(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Criteria folder section ──────────────────────────────────────────────────

interface CriteriaFolderSectionProps {
  folder: DriveCriteriaFolder;
  onPreview: (file: DriveFileItem) => void;
  onCreateFolder?: (name: string) => Promise<void>;
  onCreateSubfolderIn?: (parentDriveId: string, name: string) => Promise<void>;
}

function CriteriaFolderSection({ folder, onPreview, onCreateFolder, onCreateSubfolderIn }: CriteriaFolderSectionProps) {
  const [open, setOpen] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const totalFiles = folder.files.length + folder.subfolders.reduce((s, sf) => s + sf.files.length, 0);

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-0">
        <button
          type="button"
          className="flex-1 flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <FolderOpen className="w-4 h-4 text-[#1E2D6B] shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-[#1E2D6B] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[#1E2D6B] truncate">{folder.criteriaName}</span>
              <span className="font-mono text-xs text-muted-foreground">{folder.criteriaId}</span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">{totalFiles} file{totalFiles !== 1 ? "s" : ""}</Badge>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>

        {open && onCreateFolder && !showNewFolder && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowNewFolder(true); }}
            className="shrink-0 flex items-center gap-1 px-2 py-3 text-xs text-muted-foreground hover:text-[#1E2D6B] transition-colors"
            title="New subfolder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        )}

        {folder.driveFolderUrl && (
          <a
            href={folder.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[#1E2D6B] hover:text-[#3D4FA8] px-3 py-3"
            title="Open folder in Drive"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {open && (
        <div className="border-t divide-y divide-gray-100">
          {folder.error && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-700 bg-red-50">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{folder.error}</span>
              {folder.driveFolderUrl && (
                <a href={folder.driveFolderUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 underline hover:text-red-900">
                  Open in Drive <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {!folder.error && folder.files.length === 0 && folder.subfolders.length === 0 && !showNewFolder && (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">This folder is empty.</p>
          )}

          {folder.files.map((file) => (
            <FileRow key={file.id} file={file} onPreview={onPreview} />
          ))}

          {folder.subfolders.map((sf) => (
            <SubfolderSection
              key={sf.id}
              subfolder={sf}
              onPreview={onPreview}
              onCreateFolder={
                onCreateSubfolderIn
                  ? (name) => onCreateSubfolderIn(sf.id, name)
                  : undefined
              }
            />
          ))}

          {showNewFolder && onCreateFolder && (
            <NewFolderRow
              onCreate={onCreateFolder}
              onCancel={() => setShowNewFolder(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main browser ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export function DriveFileBrowser({
  fetchFn,
  createFolderFn,
  isProvisioning = false,
  justProvisioned = false,
}: DriveFileBrowserProps) {
  const [criteria, setCriteria] = useState<DriveCriteriaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFileItem | null>(null);
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    (opts: { silent?: boolean } = {}) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!opts.silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      fetchFn()
        .then((d) => { setCriteria(d.criteria ?? []); })
        .catch(() => { if (!opts.silent) setError("Could not load Drive files. Please try again."); })
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [fetchFn],
  );

  const load = useCallback(() => fetchData({ silent: false }), [fetchData]);
  const refresh = useCallback(() => fetchData({ silent: true }), [fetchData]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => {
    fetchData({ silent: false });
  }, [fetchData]);

  useEffect(() => {
    startPolling();

    const onVisibility = () => {
      if (document.visibilityState === "visible") { refresh(); startPolling(); }
      else stopPolling();
    };
    const onFocus = () => refresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, startPolling, stopPolling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading Drive files…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (criteria.length === 0) {
    if (isProvisioning) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-[#1E2D6B]/8 flex items-center justify-center">
              <HardDriveDownload className="w-7 h-7 text-[#1E2D6B]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200">
              <Loader2 className="w-3 h-3 text-[#1E2D6B] animate-spin" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Setting up your Drive folders…</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Your evidence workspace is being created in Google Drive. This usually takes less than a minute — this tab will update automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E2D6B] animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E2D6B] animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E2D6B] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <HardDriveDownload className="w-10 h-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No Drive folders connected yet</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Connect a Google Drive folder to a USCIS criterion using the "Connect Drive Folder" button and files will appear here.
        </p>
      </div>
    );
  }

  const totalFiles = criteria.reduce(
    (s, c) => s + c.files.length + c.subfolders.reduce((ss, sf) => ss + sf.files.length, 0),
    0,
  );

  return (
    <div className="space-y-3">
      {justProvisioned && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            Your Drive folders are ready! Files you add to these folders will sync automatically.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {totalFiles} file{totalFiles !== 1 ? "s" : ""} across {criteria.length} connected folder{criteria.length !== 1 ? "s" : ""}
          {refreshing && (
            <span className="inline-flex items-center gap-1 text-[#3D4FA8]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">syncing…</span>
            </span>
          )}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {criteria.map((folder) => (
          <CriteriaFolderSection
            key={folder.criteriaId}
            folder={folder}
            onPreview={setPreviewFile}
            onCreateFolder={
              createFolderFn
                ? (name) => createFolderFn({ name, parentDriveId: folder.driveFolderId }).then(refresh)
                : undefined
            }
            onCreateSubfolderIn={
              createFolderFn
                ? (parentDriveId, name) => createFolderFn({ name, parentDriveId }).then(refresh)
                : undefined
            }
          />
        ))}
      </div>

      <DrivePreviewModal
        open={previewFile !== null}
        fileId={previewFile?.id ?? null}
        fileName={previewFile?.name ?? ""}
        webViewLink={previewFile?.webViewLink ?? null}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
