import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DrivePreviewModalProps {
  fileId: string | null;
  fileName: string;
  webViewLink: string | null;
  open: boolean;
  onClose: () => void;
}

export function getPreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getFallbackViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function DrivePreviewModal({ fileId, fileName, webViewLink, open, onClose }: DrivePreviewModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const previewUrl = fileId ? getPreviewUrl(fileId) : null;
  const driveLink = webViewLink ?? (fileId ? getFallbackViewUrl(fileId) : null);

  const handleClose = () => {
    setIframeLoaded(false);
    setIframeError(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold truncate pr-2">{fileName}</DialogTitle>
            {driveLink && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Open in Drive
                </Button>
              </a>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden">
          {previewUrl && !iframeError ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-sm">Loading preview…</p>
                  </div>
                </div>
              )}
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={fileName}
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
                allow="autoplay"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm text-center">Preview not available for this file type.</p>
              {driveLink && (
                <a href={driveLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Open in Google Drive
                  </Button>
                </a>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
