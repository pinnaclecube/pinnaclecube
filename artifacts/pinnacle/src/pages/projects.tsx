/**
 * projects.tsx — Pinnacle³
 *
 * Client "Projects" page — top-level nav item. Resolves the client's case via
 * GET /cases/me, then renders the shared ProjectsPanel (client auth).
 */

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";

const TOKEN_KEY = "pinnacle_token";

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

export default function Projects() {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await clientFetch("/cases/me");
        if (meRes.status === 404) {
          if (!cancelled) setError("No case has been set up for your account yet. Please contact your advisor.");
          return;
        }
        if (!meRes.ok) throw new Error("case");
        const me = (await meRes.json()) as { caseId: number };
        if (!cancelled) setCaseId(me.caseId);
      } catch {
        if (!cancelled) setError("Something went wrong loading your projects. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          {error.includes("wrong") && (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Retry</Button>
          )}
        </div>
      ) : caseId !== null ? (
        <ProjectsPanel caseId={caseId} fetchFn={clientFetch} />
      ) : null}
    </AppLayout>
  );
}
