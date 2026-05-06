import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, FileImage, File, FolderOpen, Folder,
  ExternalLink, Eye, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, Loader2, HardDriveDownload,
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
  driveFolderUrl: string | null;
  files: DriveFileItem[];
  subfolders: DriveSubfolder[];
  error?: string;
}

interface DriveFileBrowserProps {
  fetchFn: () => Promise<{ criteria: DriveCriteriaFolder[] }>;
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

interface SubfolderSectionProps {
  subfolder: DriveSubfolder;
  onPreview: (file: DriveFileItem) => void;
}

function SubfolderSection({ subfolder, onPreview }: SubfolderSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t border-dashed border-gray-200">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors"
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
      {open && (
        <>
          {subfolder.error && (
            <div className="flex items-center gap-2 px-8 py-2 text-xs text-amber-700 bg-amber-50">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {subfolder.error}
            </div>
          )}
          {subfolder.files.length === 0 && !subfolder.error && (
            <p className="px-8 py-2 text-xs text-muted-foreground italic">No files in this folder.</p>
          )}
          {subfolder.files.map((file) => (
            <FileRow key={file.id} file={file} onPreview={onPreview} indent />
          ))}
        </>
      )}
    </div>
  );
}

interface CriteriaFolderSectionProps {
  folder: DriveCriteriaFolder;
  onPreview: (file: DriveFileItem) => void;
}

function CriteriaFolderSection({ folder, onPreview }: CriteriaFolderSectionProps) {
  const [open, setOpen] = useState(true);
  const totalFiles = folder.files.length + folder.subfolders.reduce((s, sf) => s + sf.files.length, 0);

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
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
        {folder.driveFolderUrl && (
          <a
            href={folder.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[#1E2D6B] hover:text-[#3D4FA8]"
            title="Open folder in Drive"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

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

          {!folder.error && folder.files.length === 0 && folder.subfolders.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">This folder is empty.</p>
          )}

          {folder.files.map((file) => (
            <FileRow key={file.id} file={file} onPreview={onPreview} />
          ))}

          {folder.subfolders.map((sf) => (
            <SubfolderSection key={sf.id} subfolder={sf} onPreview={onPreview} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DriveFileBrowser({ fetchFn }: DriveFileBrowserProps) {
  const [criteria, setCriteria] = useState<DriveCriteriaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFileItem | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFn()
      .then((d) => setCriteria(d.criteria ?? []))
      .catch(() => setError("Could not load Drive files. Please try again."))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  useEffect(() => { load(); }, [load]);

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
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {totalFiles} file{totalFiles !== 1 ? "s" : ""} across {criteria.length} connected folder{criteria.length !== 1 ? "s" : ""}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={load}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {criteria.map((folder) => (
          <CriteriaFolderSection key={folder.criteriaId} folder={folder} onPreview={setPreviewFile} />
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
