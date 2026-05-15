/**
 * my-files.tsx — Pinnacle³
 *
 * Client-facing case file & folder management page.
 * Resolves the client's case via GET /cases/me, then renders the FolderBrowser.
 */

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FolderBrowser } from "@/components/case/FolderBrowser";
import { Loader2, AlertCircle, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TOKEN_KEY = "pinnacle_token";

const VISA_LABELS: Record<string, string> = {
  eb1a: "EB-1A",
  niw:  "EB-2 NIW",
  o1a:  "O-1A",
};

function clientFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

export default function MyFiles() {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [visaPath, setVisaPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCase = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await clientFetch("/cases/me");
      if (r.status === 404) {
        setError("No case has been set up for your account yet. Please contact your advisor.");
        return;
      }
      if (!r.ok) throw new Error("Failed to resolve your case");
      const data = await r.json() as { caseId: number; visaPath: string };
      setCaseId(data.caseId);
      setVisaPath(data.visaPath ?? null);
    } catch {
      setError("Something went wrong loading your case. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCase(); }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/8 flex items-center justify-center shrink-0 mt-0.5">
            <FolderArchive className="w-5 h-5 text-[#1E2D6B]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">Case Files</h1>
              {visaPath && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 border-[#1E2D6B]/30 text-[#1E2D6B] bg-[#1E2D6B]/5 font-semibold"
                >
                  {VISA_LABELS[visaPath] ?? visaPath.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Browse, upload, and organize documents across your case folders. All files are securely stored in Google Drive and sync in real time.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          {error.includes("wrong") && (
            <Button size="sm" variant="outline" onClick={loadCase}>Retry</Button>
          )}
        </div>
      ) : caseId !== null ? (
        <FolderBrowser caseId={caseId} fetchFn={clientFetch} />
      ) : null}
    </AppLayout>
  );
}
