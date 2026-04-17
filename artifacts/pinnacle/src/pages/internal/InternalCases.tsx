import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { Search, User, ChevronRight } from "lucide-react";

interface CaseProfile {
  id: number;
  name: string | null;
  email: string;
  visaTarget: string;
  accessLevel: string;
  createdAt: string;
}

export default function InternalCases() {
  const [profiles, setProfiles] = useState<CaseProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/profiles", {
          headers: { "X-Staff-Token": getStaffToken() ?? "" },
        });
        if (res.ok) {
          const data = await res.json();
          setProfiles(data.profiles ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

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

      <main className="px-8 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Active Cases</h2>
          <Badge variant="secondary">{profiles.length} clients</Badge>
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
            <CardContent className="py-16 text-center">
              <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No results found." : "No cases yet."}</p>
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
      </main>
    </div>
  );
}
