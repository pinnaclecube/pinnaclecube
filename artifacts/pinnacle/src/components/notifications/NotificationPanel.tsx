import { Link } from "wouter";
import { X, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Notification } from "./NotificationBell";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onRefresh: () => void;
  token: string;
  onUpdate: (notifications: Notification[]) => void;
}

export function NotificationPanel({ open, onClose, notifications, onRefresh, token, onUpdate }: NotificationPanelProps) {
  const markRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    onUpdate(notifications.map((n) => n.id === id ? { ...n, status: "read" } : n));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    onUpdate(notifications.map((n) => ({ ...n, status: "read" })));
  };

  const deleteNotification = async (id: number) => {
    await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onUpdate(notifications.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const formatDate = (str: string) => {
    const d = new Date(str);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-[#1E2D6B] text-white text-xs">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-7">
                  <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <CheckCheck className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">All caught up</p>
              <p className="text-sm text-muted-foreground">No notifications at this time.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-6 py-4 transition-colors group ${n.status === "unread" ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.status === "unread" ? "bg-[#1E2D6B]" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold leading-tight ${n.status === "unread" ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => { markRead(n.id); onClose(); }}
                            className="text-xs text-[#1E2D6B] font-medium flex items-center gap-1 hover:underline"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        {n.status === "unread" && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
