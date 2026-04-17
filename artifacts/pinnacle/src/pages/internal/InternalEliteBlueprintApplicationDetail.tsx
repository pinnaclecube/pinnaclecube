import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft } from "lucide-react";

export default function InternalEliteBlueprintApplicationDetail() {
  const { id } = useParams() as { id: string };
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/blueprint-applications/${id}`, {
          headers: { "X-Staff-Token": getStaffToken() ?? "" },
        });
        if (res.ok) {
          const data = await res.json();
          setApplication(data);
          setStatus(data.status ?? "pending");
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleStatusUpdate = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/blueprint-applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Staff-Token": getStaffToken() ?? "" },
        body: JSON.stringify({ status }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <Link href="/internal/elite-blueprint-applications" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> All Applications
        </Link>
      </header>
      <main className="px-8 py-8 max-w-3xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />)}
          </div>
        ) : !application ? (
          <p className="text-muted-foreground">Application not found.</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">{application.name}</h1>
                <p className="text-muted-foreground">{application.email} · {application.targetVisa?.toUpperCase()}</p>
              </div>
              <Badge className="capitalize">{application.status?.replace(/_/g, " ")}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Current Role", value: application.currentRole },
                { label: "Company", value: application.company },
                { label: "Field", value: application.field },
                { label: "Timeline", value: application.timeline?.replace(/_/g, " ") },
              ].filter((f) => f.value).map((f) => (
                <Card key={f.label}>
                  <CardHeader><CardTitle className="text-sm text-muted-foreground">{f.label}</CardTitle></CardHeader>
                  <CardContent><p className="font-medium">{f.value}</p></CardContent>
                </Card>
              ))}

              {application.background && (
                <Card>
                  <CardHeader><CardTitle className="text-sm text-muted-foreground">Professional Background</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed">{application.background}</p></CardContent>
                </Card>
              )}
              {application.strongestCriteria && (
                <Card>
                  <CardHeader><CardTitle className="text-sm text-muted-foreground">Strongest Criteria</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed">{application.strongestCriteria}</p></CardContent>
                </Card>
              )}
              {application.goal && (
                <Card>
                  <CardHeader><CardTitle className="text-sm text-muted-foreground">Goal</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed">{application.goal}</p></CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Update Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleStatusUpdate} disabled={saving} size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                      {saving ? "Saving..." : "Update"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
