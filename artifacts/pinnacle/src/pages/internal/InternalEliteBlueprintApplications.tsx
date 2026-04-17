import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, ChevronRight, Map } from "lucide-react";

interface Application {
  id: number;
  name: string;
  email: string;
  targetVisa: string;
  status: string;
  createdAt: string;
}

export default function InternalEliteBlueprintApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/blueprint-applications", {
          headers: { "X-Staff-Token": getStaffToken() ?? "" },
        });
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/internal/cases" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> All Cases
          </Link>
          <span className="font-bold">Elite Blueprint Applications</span>
          <div />
        </div>
      </header>
      <main className="px-8 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Blueprint Applications</h2>
          <Badge variant="secondary">{applications.length} total</Badge>
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        ) : applications.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><Map className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No applications yet.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {applications.map((a) => (
              <Link key={a.id} href={`/internal/elite-blueprint-applications/${a.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-sm text-muted-foreground">{a.email} · {a.targetVisa?.toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${statusColor[a.status] ?? "bg-gray-100 text-gray-800"} border-0 capitalize`}>{a.status?.replace(/_/g, " ")}</Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
