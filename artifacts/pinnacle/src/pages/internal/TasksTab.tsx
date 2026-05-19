import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, Send, ClipboardList } from "lucide-react";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "draft" | "sent" | "completed" | "cancelled";
  createdAt: string;
  sentAt: string | null;
  clientCompletedAt: string | null;
  adminCompletedAt: string | null;
}

export interface TasksTabProps {
  userId: string;
  onSentCountChange: (count: number) => void;
}

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

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide shrink-0",
      priority === "high" ? "bg-red-100 text-red-700" :
      priority === "medium" ? "bg-amber-100 text-amber-700" :
      "bg-gray-100 text-gray-600",
    )}>
      {priority}
    </span>
  );
}

function daysSince(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

interface TaskCardProps {
  task: ActionItem;
  onUpdateStatus: (aid: number, status: string) => Promise<void>;
}

function TaskCard({ task, onUpdateStatus }: TaskCardProps) {
  const [busy, setBusy] = useState(false);

  const act = async (status: string) => {
    setBusy(true);
    try { await onUpdateStatus(task.id, status); }
    finally { setBusy(false); }
  };

  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isDimmed = isCompleted || isCancelled;

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 flex items-start gap-3",
      isDimmed ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 shadow-sm",
    )}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={task.priority} />
          <p className={cn(
            "text-sm font-semibold",
            isCompleted && "line-through text-muted-foreground",
            isCancelled && "text-muted-foreground",
          )}>
            {task.title}
          </p>
        </div>
        {task.description && (
          <p className={cn("text-xs text-muted-foreground leading-relaxed", isDimmed && "opacity-60")}>
            {task.description}
          </p>
        )}
        {task.status === "sent" && task.sentAt && (
          <p className="text-xs text-muted-foreground">Sent {daysSince(task.sentAt)}</p>
        )}
        {isCompleted && task.adminCompletedAt && (
          <p className="text-xs text-muted-foreground">
            Completed {new Date(task.adminCompletedAt).toLocaleDateString()}
          </p>
        )}
        {isCancelled && (
          <p className="text-xs text-muted-foreground">Cancelled</p>
        )}
      </div>

      {!isDimmed && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {task.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5"
              disabled={busy}
              onClick={() => act("sent")}
            >
              {busy
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Send className="w-3 h-3" />}
              Send to Client
            </Button>
          )}
          {task.status === "sent" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
              disabled={busy}
              onClick={() => act("completed")}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Mark Complete
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-red-600"
            disabled={busy}
            onClick={() => act("cancelled")}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function TasksTab({ userId, onSentCountChange }: TasksTabProps) {
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [saving, setSaving] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

  const applyTasks = useCallback((next: ActionItem[]) => {
    setTasks(next);
    onSentCountChange(next.filter((t) => t.status === "sent").length);
  }, [onSentCountChange]);

  const fetchTasks = useCallback(async () => {
    try {
      const r = await staffFetch(`/admin/profiles/${userId}/action-items`);
      const d = await r.json();
      applyTasks(d.actionItems ?? []);
    } catch { /* ignore */ }
  }, [userId, applyTasks]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async (initialStatus: "draft" | "sent") => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await staffFetch(`/admin/profiles/${userId}/action-items`, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          priority: newPriority,
          status: initialStatus,
        }),
      });
      const d = await r.json();
      if (d.actionItem) {
        setTasks((prev) => {
          const next = [d.actionItem, ...prev];
          onSentCountChange(next.filter((t) => t.status === "sent").length);
          return next;
        });
        setNewTitle("");
        setNewDesc("");
        setNewPriority("medium");
      }
    } finally { setSaving(false); }
  };

  const updateStatus = useCallback(async (aid: number, status: string) => {
    const r = await staffFetch(`/admin/profiles/${userId}/action-items/${aid}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (d.actionItem) {
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === aid ? d.actionItem : t));
        onSentCountChange(next.filter((t) => t.status === "sent").length);
        return next;
      });
    }
  }, [userId, onSentCountChange]);

  const sent = tasks.filter((t) => t.status === "sent");
  const drafts = tasks.filter((t) => t.status === "draft");
  const completed = tasks.filter((t) => t.status === "completed");
  const cancelled = tasks.filter((t) => t.status === "cancelled");

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Create form ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            Assign New Task
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            placeholder="Describe what the client needs to do..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="min-h-[72px] resize-none"
          />

          {/* Priority toggle group */}
          <div className="flex gap-1.5">
            {(["low", "medium", "high"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNewPriority(p)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded border transition-colors capitalize",
                  newPriority === p
                    ? p === "high"
                      ? "bg-red-50 border-red-400 text-red-700"
                      : p === "medium"
                        ? "bg-amber-50 border-amber-400 text-amber-700"
                        : "bg-gray-100 border-gray-400 text-gray-700"
                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600",
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!newTitle.trim() || saving}
              onClick={() => createTask("draft")}
            >
              Save as Draft
            </Button>
            <Button
              size="sm"
              className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
              disabled={!newTitle.trim() || saving}
              onClick={() => createTask("sent")}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Send className="w-3.5 h-3.5" />
              Send to Client
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Task list ───────────────────────────────────────────────────── */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No tasks yet. Use the form above to assign work to this client.
        </div>
      ) : (
        <div className="space-y-6">

          {/* Awaiting Client */}
          {sent.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground">Awaiting Client</h3>
                <Badge className="bg-red-500 text-white border-0 text-xs px-1.5 py-0.5 leading-none rounded-full h-auto">
                  {sent.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {sent.map((t) => <TaskCard key={t.id} task={t} onUpdateStatus={updateStatus} />)}
              </div>
            </section>
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Drafts</h3>
              <div className="space-y-2">
                {drafts.map((t) => <TaskCard key={t.id} task={t} onUpdateStatus={updateStatus} />)}
              </div>
            </section>
          )}

          {/* Completed (collapsible, collapsed by default) */}
          {completed.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setCompletedOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ChevronRight className={cn("w-4 h-4 transition-transform", completedOpen && "rotate-90")} />
                Completed ({completed.length})
              </button>
              {completedOpen && (
                <div className="space-y-2">
                  {completed.map((t) => <TaskCard key={t.id} task={t} onUpdateStatus={updateStatus} />)}
                </div>
              )}
            </section>
          )}

          {/* Cancelled (collapsible, collapsed by default) */}
          {cancelled.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setCancelledOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ChevronRight className={cn("w-4 h-4 transition-transform", cancelledOpen && "rotate-90")} />
                Cancelled ({cancelled.length})
              </button>
              {cancelledOpen && (
                <div className="space-y-2">
                  {cancelled.map((t) => <TaskCard key={t.id} task={t} onUpdateStatus={updateStatus} />)}
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  );
}
