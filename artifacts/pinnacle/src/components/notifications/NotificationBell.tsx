import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "./NotificationPanel";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: number;
  title: string;
  message: string;
  status: string;
  notificationType: string;
  link: string | null;
  priority: string | null;
  createdAt: string;
}

// ─── SSE hook ─────────────────────────────────────────────────────────────────
//
// Opens /api/notifications/stream via fetch() (not EventSource) so the Bearer
// JWT can be sent in the Authorization header.
// On "notification" events, calls onNotification with the new notification
// object. Falls back silently to polling if the stream errors or drops.

function useNotificationSSE(
  token: string | null,
  onNotification: (n: Notification) => void,
) {
  const cbRef = useRef(onNotification);
  useEffect(() => { cbRef.current = onNotification; }, [onNotification]);

  useEffect(() => {
    if (!token) return;
    const ctrl = new AbortController();
    let alive = true;

    void (async () => {
      try {
        const res = await fetch("/api/notifications/stream", {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let eventName = "";

        while (alive) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              if (eventName === "notification") {
                try {
                  const payload = JSON.parse(line.slice(6));
                  if (payload.notification) cbRef.current(payload.notification as Notification);
                } catch { /* ignore malformed */ }
              }
              eventName = "";
            }
          }
        }
      } catch {
        // AbortError on unmount; network errors fall back to polling
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [token]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silently ignore
    }
  }, [token]);

  // Polling fallback — fires every 60 s; SSE is the fast path
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // SSE — prepend new notification immediately on push
  const handleSSENotification = useCallback((incoming: Notification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === incoming.id)) return prev;
      return [incoming, ...prev];
    });
  }, []);

  useNotificationSSE(token, handleSSENotification);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          setOpen(true);
          fetchNotifications();
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
        token={token ?? ""}
        onUpdate={setNotifications}
      />
    </>
  );
}
