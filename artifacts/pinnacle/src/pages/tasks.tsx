import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ActionItem {
  id: number;
  profileId: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  adminNotes: string | null;
  sentAt: string | null;
  clientCompletedAt: string | null;
  adminCompletedAt: string | null;
  createdAt: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  high:   { label: "HIGH",   className: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "MEDIUM", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low:    { label: "LOW",    className: "bg-blue-50 text-blue-700 border-blue-200" },
};

function formatDaysAgo(dateStr: string | null): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getClientNote(adminNotes: string | null): string | null {
  if (!adminNotes) return null;
  const prefix = "Client note: ";
  for (const chunk of adminNotes.split("\n\n")) {
    if (chunk.startsWith(prefix)) return chunk.slice(prefix.length);
  }
  return null;
}

function PageSkeleton() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <div className="h-9 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-72 rounded bg-gray-100 animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    </AppLayout>
  );
}

export default function Tasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState<Set<number>>(new Set());

  const [completedExpanded, setCompletedExpanded] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/action-items", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data.actionItems ?? []);
    } catch {
      // leave tasks empty
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openModal = (id: number) => {
    setCompletingId(id);
    setNote("");
    setSubmitError(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setCompletingId(null);
  };

  const handleComplete = async () => {
    if (!completingId || !token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/action-items/${completingId}/complete`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to mark task complete");
      }
      const data = await res.json() as { actionItem: ActionItem };

      const id = completingId;
      setCompletingId(null);
      setNote("");

      setFadingOut((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setTasks((prev) => prev.map((t) => (t.id === id ? data.actionItem : t)));
        setFadingOut((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }, 320);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to complete task");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTasks = tasks
    .filter((t) => t.status === "sent")
    .sort((a, b) => {
      const po = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (po !== 0) return po;
      const aDate = a.sentAt ?? a.createdAt;
      const bDate = b.sentAt ?? b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

  const completedTasks = tasks.filter((t) => t.status === "completed");

  if (loading) return <PageSkeleton />;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Action items assigned by your Pinnacle advisory team.
          </p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{pendingTasks.length}</div>
            <div className="text-sm font-medium text-amber-600 mt-0.5">Pending</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 text-center">
            <div className="text-2xl font-bold text-green-700">{completedTasks.length}</div>
            <div className="text-sm font-medium text-green-600 mt-0.5">Completed</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{tasks.length}</div>
            <div className="text-sm font-medium text-gray-500 mt-0.5">Total</div>
          </div>
        </div>

        {/* Pending tasks */}
        {pendingTasks.length === 0 ? (
          <Card className="border-green-200 bg-green-50/40">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-foreground text-lg">You're all caught up!</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Your Pinnacle team will assign tasks here when action is needed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Pending Tasks
            </h2>
            {pendingTasks.map((task) => {
              const pc =
                PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
              const isFading = fadingOut.has(task.id);
              return (
                <div
                  key={task.id}
                  className="transition-all duration-300 ease-in-out"
                  style={{
                    opacity: isFading ? 0 : 1,
                    transform: isFading ? "scale(0.97)" : "scale(1)",
                    pointerEvents: isFading ? "none" : undefined,
                  }}
                >
                  <Card className="border border-gray-200 hover:border-[#1E2D6B]/25 transition-colors">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="mb-2">
                            <Badge
                              className={`text-[11px] font-semibold border px-2 py-0.5 ${pc.className}`}
                            >
                              {pc.label}
                            </Badge>
                          </div>
                          <p className="font-semibold text-foreground leading-snug">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Assigned{" "}
                            {formatDaysAgo(task.sentAt ?? task.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 mt-1">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                            onClick={() => openModal(task.id)}
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                            Mark Complete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed tasks — collapsible */}
        {completedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setCompletedExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              {completedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Completed Tasks ({completedTasks.length})
            </button>

            {completedExpanded && (
              <div className="space-y-3">
                {completedTasks.map((task) => {
                  const pc =
                    PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                  const clientNote = getClientNote(task.adminNotes);
                  return (
                    <Card
                      key={task.id}
                      className="border border-gray-100 opacity-60"
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="mb-2">
                              <Badge
                                className={`text-[11px] font-semibold border px-2 py-0.5 ${pc.className}`}
                              >
                                {pc.label}
                              </Badge>
                            </div>
                            <p className="font-semibold text-muted-foreground leading-snug line-through">
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                            {clientNote && (
                              <p className="text-xs text-muted-foreground mt-1.5 italic">
                                Your note: {clientNote}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right mt-1">
                            <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Completed
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(
                                task.clientCompletedAt ?? task.adminCompletedAt
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mark complete modal */}
      <Dialog
        open={completingId !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Task Complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Textarea
              placeholder="Add a note for your Pinnacle team (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleComplete}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Completing…
                </>
              ) : (
                <>
                  <CheckCheck className="w-4 h-4 mr-1.5" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
