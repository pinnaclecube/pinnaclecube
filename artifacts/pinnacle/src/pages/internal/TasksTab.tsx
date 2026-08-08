import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, Send, ClipboardList, RotateCcw } from "lucide-react";
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
  onAction: (aid: number, action: "resend" | "reopen") => Promise<void>;
}

function TaskCard({ task, onUpdateStatus, onAction }: TaskCardProps) {
  const [busy, setBusy] = useState(false);

  const act = async (status: string) => {
    setBusy(true);
    try { await onUpdateStatus(task.id, status); }
    finally { setBusy(false); }
  };

  const runAction = async (action: "resend" | "reopen") => {
    setBusy(true);
    try { await onAction(task.id, action); }
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
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5"
              disabled={busy}
              onClick={() => runAction("resend")}
              title="Re-send the task email and notification to the client"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Resend
            </Button>
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
          </>
        )}
        {(isCompleted || isCancelled) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5"
            disabled={busy}
            onClick={() => runAction("reopen")}
            title="Reopen this task and notify the client"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reopen
          </Button>
        )}
        {!isDimmed && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-red-600"
            disabled={busy}
            onClick={() => act("cancelled")}
          >
            Cancel
          </Button>
        )}
      </div>
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
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (aid: number, status: string) => {
    await staffFetch(`/admin/profiles/${userId}/action-items/${aid}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await fetchTasks();
  };

  const performAction = async (aid: number, action: "resend" | "reopen") => {
    await staffFetch(`/admin/profiles/${userId}/action-items/${aid}/${action}`, {
      method: "POST",
    });
    await fetchTasks();
  };

  const draftTasks = tasks.filter((t) => t.status === "draft");
  const sentTasks = tasks.filter((t) => t.status === "sent");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const cancelledTasks = tasks.filter((t) => t.status === "cancelled");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Priority:</label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => createTask("draft")}
              disabled={saving || !newTitle.trim()}
              variant="outline"
              size="sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => createTask("sent")}
              disabled={saving || !newTitle.trim()}
              size="sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to Client
            </Button>
          </div>
        </CardContent>
      </Card>

      {draftTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Drafts ({draftTasks.length})
          </h3>
          {draftTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdateStatus={updateStatus}
              onAction={performAction}
            />
          ))}
        </div>
      )}

      {sentTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Send className="w-4 h-4" />
            Active Tasks ({sentTasks.length})
          </h3>
          {sentTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdateStatus={updateStatus}
              onAction={performAction}
            />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setCompletedOpen(!completedOpen)}
            className="text-sm font-semibold flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform", completedOpen && "rotate-90")} />
            Completed ({completedTasks.length})
          </button>
          {completedOpen && completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdateStatus={updateStatus}
              onAction={performAction}
            />
          ))}
        </div>
      )}

      {cancelledTasks.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setCancelledOpen(!cancelledOpen)}
            className="text-sm font-semibold flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform", cancelledOpen && "rotate-90")} />
            Cancelled ({cancelledTasks.length})
          </button>
          {cancelledOpen && cancelledTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdateStatus={updateStatus}
              onAction={performAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}