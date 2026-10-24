/**
 * ProjectDocuments.tsx — Pinnacle³
 *
 * Evidence documents panel for a project. Shared by the client portal and the
 * staff portal (both pass their own `fetchFn` — client Bearer or X-Staff-Token).
 * Upload (category + description), list, authenticated download, delete.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, Download, Trash2, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ProjectDocument {
  id: number;
  projectId: number;
  categoryId: number | null;
  categoryName: string | null;
  driveFileId: string;
  fileName: string | null;
  description: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface LookupItem {
  id: number;
  name: string;
}

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

const ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";
const ALLOWED_EXT = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"];

export function ProjectDocuments({
  projectId, fetchFn, categories, documents, onChange,
}: {
  projectId: number;
  fetchFn: FetchFn;
  categories: LookupItem[];
  documents: ProjectDocument[];
  onChange: (docs: ProjectDocument[]) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      toast({ title: "File must be a PDF, DOCX, XLSX, PNG, or JPG", variant: "destructive" });
      return;
    }
    if (!categoryId) {
      toast({ title: "Choose a category first", variant: "destructive" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("categoryId", categoryId);
      if (description.trim()) form.append("description", description.trim());
      const r = await fetchFn(`/projects/${projectId}/documents`, { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      onChange([...documents, d.document as ProjectDocument]);
      setDescription("");
      toast({ title: "Document uploaded" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload(doc: ProjectDocument) {
    setDownloadingId(doc.id);
    try {
      const r = await fetchFn(`/project-documents/${doc.id}/download`);
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Download failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName ?? `project-document-${doc.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Download failed", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(doc: ProjectDocument) {
    setDeletingId(doc.id);
    try {
      const r = await fetchFn(`/project-documents/${doc.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      onChange(documents.filter((x) => x.id !== doc.id));
      toast({ title: "Document removed" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload row */}
      <div className="rounded-lg border bg-gray-50/60 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note about this file" />
          </div>
        </div>
        <label className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded border px-2.5 py-1.5 border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5 transition-colors",
          uploading && "opacity-60 pointer-events-none",
        )}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload document
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0])} />
        </label>
        <p className="text-[11px] text-muted-foreground">PDF, DOCX, XLSX, PNG, or JPG · up to 25 MB</p>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Paperclip className="w-6 h-6 text-gray-300" />
          No evidence documents yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{doc.fileName ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[doc.categoryName, doc.description].filter(Boolean).join(" · ") || "—"}
                  {doc.uploadedBy === "staff" && <span className="ml-1 text-amber-600">· added by staff</span>}
                </p>
              </div>
              <button onClick={() => void handleDownload(doc)} disabled={downloadingId === doc.id}
                className="p-1.5 text-gray-400 hover:text-[#1E2D6B] transition-colors" title="Download">
                {downloadingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              <button onClick={() => void handleDelete(doc)} disabled={deletingId === doc.id}
                className="p-1.5 text-gray-300 hover:text-red-600 transition-colors" title="Delete">
                {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
