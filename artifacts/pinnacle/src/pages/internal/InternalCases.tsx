import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  Search,
  User,
  ChevronRight,
  Database,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FolderSync,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseProfile {
  id: number;
  name: string | null;
  email: string;
  visaTarget: string;
  accessLevel: string;
  createdAt: string;
}

interface FailedDriveSyncCase {
  caseId: number;
  profileId: number;
  visaPath: string;
  driveSyncStatus: string;
  driveSyncError: string | null;
  clientName: string;
  clientEmail: string;
  createdAt: string;
}

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

export default function InternalCases() {
  const [profiles, setProfiles] = useState<CaseProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [driveSyncIssues, setDriveSyncIssues] = useState<FailedDriveSyncCase[]>([]);
  const [retrying, setRetrying] = useState<Set<number>>(new Set());
  const [retryResults, setRetryResults] = useState<Record<number, "success" | "error">>({});

  const loadProfiles = useCallback(async () => {
    try {
      const res = await staffFetch("/admin/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadDriveSyncIssues = useCallback(async () => {
    try {
      const res = await staffFetch("/internal/petition/failed-drive-syncs");
      if (res.ok) {
        const data = await res.json();
        setDriveSyncIssues(data.cases ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadDriveSyncIssues();
  }, [loadProfiles, loadDriveSyncIssues]);

  const retryDriveSync = async (caseId: number) => {
    setRetrying((prev) => new Set(prev).add(caseId));
    setRetryResults((prev) => { const n = { ...prev }; delete n[caseId]; return n; });
    try {
      const res = await staffFetch(`/internal/petition/setup/${caseId}/retry-drive`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRetryResults((prev) => ({ ...prev, [caseId]: "success" }));
        setDriveSyncIssues((prev) => prev.filter((c) => c.caseId !== caseId));
      } else {
        setRetryResults((prev) => ({ ...prev, [caseId]: "error" }));
        // Refresh error detail
        await loadDriveSyncIssues();
      }
    } catch {
      setRetryResults((prev) => ({ ...prev, [caseId]: "error" }));
    } finally {
      setRetrying((prev) => { const n = new Set(prev); n.delete(caseId); return n; });
    }
  };

  const seedDemo = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await staffFetch("/admin/seed-demo", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        if (d.alreadySeeded) {
          setSeedMsg({ type: "info", text: "Demo data already present — nothing changed." });
        } else {
          setSeedMsg({ type: "success", text: `Seeded ${d.summary.profiles} clients, ${d.summary.prospects} prospects, and ${d.summary.applications} Blueprint applications.` });
          await loadProfiles();
        }
      } else {
        setSeedMsg({ type: "error", text: d.detail ?? d.error ?? "Seed failed — check server logs." });
      }
    } catch {
      setSeedMsg({ type: "error", text: "Network error — could not reach the API." });
    } finally {
      setSeeding(false);
    }
  };

  const filtered = profiles.filter((p) =>
    (p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Pinnacle³ Staff Portal</h1>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/internal/prospects" className="hover:text-white transition-colors">Prospects</Link>
            <Link href="/internal/elite-blueprint-applications" className="hover:text-white transition-colors">Blueprint Apps</Link>
          </div>
        </div>
      </header>

      <main className="px-8 py-8 max-w-5xl mx-auto space-y-8">

        {/* ── Drive Sync Issues ──────────────────────────────────────────── */}
        {driveSyncIssues.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FolderSync className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">Drive Sync Issues</h3>
              <Badge variant="destructive" className="text-xs">{driveSyncIssues.length}</Badge>
            </div>
            <div className="space-y-2">
              {driveSyncIssues.map((c) => (
                <div
                  key={c.caseId}
                  className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <Link href={`/internal/case/${c.profileId}`}>
                        <span className="text-sm font-medium text-red-800 hover:underline cursor-pointer">
                          {c.clientName}
                        </span>
                      </Link>
                      <span className="text-xs text-red-500 font-mono">Case #{c.caseId}</span>
                      <Badge variant="outline" className="text-xs border-red-200 text-red-700">
                        {c.visaPath.toUpperCase()}
                      </Badge>
                    </div>
                    {c.driveSyncError && (
                      <p className="mt-1 text-xs text-red-600 font-mono truncate ml-6">
                        {c.driveSyncError}
                      </p>
                    )}
                    {retryResults[c.caseId] === "success" && (
                      <p className="mt-1 text-xs text-green-700 ml-6 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Folders created successfully
                      </p>
                    )}
                    {retryResults[c.caseId] === "error" && (
                      <p className="mt-1 text-xs text-red-700 ml-6">Retry failed — check server logs</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs border-red-300 text-red-700 hover:bg-red-100 gap-1.5"
                    disabled={retrying.has(c.caseId)}
                    onClick={() => retryDriveSync(c.caseId)}
                  >
                    {retrying.has(c.caseId)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    {retrying.has(c.caseId) ? "Retrying…" : "Retry"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Cases list ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Active Cases</h2>
              {seedMsg && (
                <div className={cn(
                  "flex items-center gap-1.5 mt-1 text-sm",
                  seedMsg.type === "success" ? "text-green-700" : seedMsg.type === "error" ? "text-red-600" : "text-blue-700",
                )}>
                  {seedMsg.type === "success" && <CheckCircle className="w-3.5 h-3.5" />}
                  {seedMsg.type === "error" && <AlertTriangle className="w-3.5 h-3.5" />}
                  {seedMsg.text}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{profiles.length} clients</Badge>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={seedDemo}
                disabled={seeding}
                title="Load demo client data into this environment"
              >
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {seeding ? "Seeding…" : "Load Demo Data"}
              </Button>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <User className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">{search ? "No results found." : "No cases yet."}</p>
                {!search && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-3">This is a fresh environment — load demo client data to get started.</p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={seedDemo}
                      disabled={seeding}
                    >
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {seeding ? "Loading demo data…" : "Load Demo Data"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <Link key={p.id} href={`/internal/case/${p.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center font-bold text-[#1E2D6B]">
                            {(p.name ?? p.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold">{p.name ?? "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{p.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{p.visaTarget.toUpperCase()}</Badge>
                          <Badge className="bg-[#1E2D6B]/10 text-[#1E2D6B] border-0 capitalize">{p.accessLevel.replace(/_/g, " ")}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
