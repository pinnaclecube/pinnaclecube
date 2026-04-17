import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { ArrowLeft, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function staffFetch(path: string) {
  return fetch(`/api${path}`, { headers: { "X-Staff-Token": getStaffToken() ?? "" } });
}

const EVENT_COLORS: Record<string, string> = {
  admin_password_reset: "bg-orange-100 text-orange-700",
  lessons_invalidated: "bg-yellow-100 text-yellow-700",
  blueprint_access_granted: "bg-green-100 text-green-700",
  blueprint_status_approved: "bg-green-100 text-green-700",
  blueprint_status_declined: "bg-red-100 text-red-700",
  action_item: "bg-blue-100 text-blue-700",
  intake_completed: "bg-purple-100 text-purple-700",
  drive_folders_created: "bg-indigo-100 text-indigo-700",
};

export default function InternalCaseActivityLog() {
  const { user_id } = useParams() as { user_id: string };
  const [events, setEvents] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      staffFetch(`/admin/profiles/${user_id}/activity-log`).then((r) => r.json()),
      staffFetch(`/admin/profiles/${user_id}`).then((r) => r.json()),
    ]).then(([logData, profileData]) => {
      setEvents(logData.events ?? []);
      setProfileName(profileData.profile?.name ?? profileData.profile?.email ?? `#${user_id}`);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user_id]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        <Link href={`/internal/case/${user_id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Case
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-5 h-5 text-[#1E2D6B]" />
          <h1 className="text-xl font-bold">Activity Log — {profileName}</h1>
          <Badge variant="secondary">{events.length} events</Badge>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No activity recorded yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-4 pl-10">
              {events.map((event, idx) => (
                <div key={event.id ?? idx} className="relative">
                  <div className="absolute -left-6 top-2 w-3 h-3 rounded-full bg-white border-2 border-[#1E2D6B]" />
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn("text-xs border-0", EVENT_COLORS[event.eventType] ?? "bg-gray-100 text-gray-600")}>
                              {event.eventType.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {event.eventData?.message && (
                            <p className="text-sm mt-1">{event.eventData.message}</p>
                          )}
                          {event.eventData && Object.keys(event.eventData).filter((k) => k !== "message").length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Event data</summary>
                              <pre className="text-xs font-mono bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(event.eventData, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
