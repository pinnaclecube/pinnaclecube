import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { Search, Map, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function staffFetch(path: string) {
  return fetch(`/api${path}`, { headers: { "X-Staff-Token": getStaffToken() ?? "" } });
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-700",
  under_review: "bg-blue-100 text-blue-700",
  needs_more_info: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  access_granted: "bg-purple-100 text-purple-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  received: "bg-green-100 text-green-700",
  waived: "bg-blue-100 text-blue-700",
};

export default function InternalEliteBlueprintApplications() {
  const [applications, setApplications] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffFetch("/internal/blueprint-applications")
      .then((r) => r.json())
      .then((d) => { setApplications(d.applications ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = applications.filter((a: any) =>
    (a.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (a.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Blueprint Applications</h2>
            <p className="text-sm text-muted-foreground">{applications.length} total</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…" className="pl-9" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Map className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No matching applications." : "No applications yet."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((a: any) => (
              <Link key={a.id} href={`/internal/elite-blueprint-applications/${a.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center text-[#1E2D6B] font-bold shrink-0">
                          {(a.fullName ?? a.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{a.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.email}{a.visaPath ? ` · ${a.visaPath.toUpperCase()}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.adminConfidenceScore && (
                          <Badge variant="outline" className="text-xs">Score: {a.adminConfidenceScore}/10</Badge>
                        )}
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600")}>
                          {a.status.replace(/_/g, " ")}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", PAYMENT_COLORS[a.paymentStatus ?? "pending"])}>
                          {(a.paymentStatus ?? "pending").replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
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
