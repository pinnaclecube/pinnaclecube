/**
 * ProjectsTab.tsx — Pinnacle³ (staff case detail)
 *
 * Staff view + full add/edit/delete of a case's projects. Resolves the case id
 * from the profile via /internal/petition/setup/:userId, then renders the shared
 * ProjectsPanel with X-Staff-Token auth — full parity with the client portal.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";

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

export function ProjectsTab({ userId }: { userId: string }) {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const setupRes = await staffFetch(`/internal/petition/setup/${userId}`);
      const setupData = (await setupRes.json()) as { cases?: { setup?: { id: number } }[] };
      const resolvedCaseId = setupData.cases?.[0]?.setup?.id ?? null;
      if (!resolvedCaseId) {
        setError("No case has been set up for this client yet.");
        return;
      }
      setCaseId(resolvedCaseId);
    } catch {
      setError("Something went wrong loading projects. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void resolveCase(); }, [resolveCase]);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" /></div>;
  }
  if (error) {
    return <div className="text-sm text-muted-foreground py-12 text-center">{error}</div>;
  }
  if (caseId === null) return null;

  return <ProjectsPanel caseId={caseId} fetchFn={staffFetch} staff compact />;
}
