import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, FileText, BarChart2, Clock } from "lucide-react";

export default function InternalCaseDetail() {
  const { user_id } = useParams() as { user_id: string };
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/profiles/${user_id}`, {
          headers: { "X-Staff-Token": getStaffToken() ?? "" },
        });
        if (res.ok) setProfile(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user_id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <Link href="/internal/cases" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> All Cases
        </Link>
      </header>
      <main className="px-8 py-8 max-w-4xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ) : !profile ? (
          <p className="text-muted-foreground">Client not found.</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold">{profile.name ?? profile.email}</h1>
                <p className="text-muted-foreground mt-1">{profile.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{profile.visaTarget?.toUpperCase()}</Badge>
                  <Badge className="bg-[#1E2D6B]/10 text-[#1E2D6B] border-0 capitalize">
                    {profile.accessLevel?.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/internal/case/${user_id}/activity-log`}>
                  <Button variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-1" /> Activity Log
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Evidence Uploaded</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-[#1E2D6B]">{profile.evidenceCount ?? "—"}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Readiness Score</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-[#1E2D6B]">{profile.readinessScore ?? "—"}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Joined</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Case Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Detailed case management UI coming soon.</p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
