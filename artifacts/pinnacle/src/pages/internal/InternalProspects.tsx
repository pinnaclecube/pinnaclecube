import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { Search, Users, ChevronRight, ArrowLeft } from "lucide-react";

interface Prospect {
  id: number;
  name: string;
  email: string;
  source: string | null;
  stage: string;
  createdAt: string;
}

export default function InternalProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/prospects", {
          headers: { "X-Staff-Token": getStaffToken() ?? "" },
        });
        if (res.ok) {
          const data = await res.json();
          setProspects(data.prospects ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = prospects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/internal/cases" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> All Cases
          </Link>
          <span className="font-bold">Prospects</span>
          <div />
        </div>
      </header>
      <main className="px-8 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Prospects</h2>
          <Badge variant="secondary">{prospects.length} total</Badge>
        </div>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prospects..." className="pl-9" />
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No prospects found.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Link key={p.id} href={`/internal/prospect/${p.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{p.stage}</Badge>
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
