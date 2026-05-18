import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffNotificationPanel } from "./StaffNotificationPanel";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";

export interface StaffNotification {
  id: number;
  title: string;
  message: string;
  status: string;
  notificationType: string;
  link: string | null;
  caseSetupId: number | null;
  createdAt: string;
}

// ─── SSE hook ─────────────────────────────────────────────────────────────────
//
// Opens /api/admin/notifications/stream via fetch() (not EventSource) so the
// X-Staff-Token can be sent in a header.
// On "notification" events, calls onNotification with the new notification.
// Falls back silently to 60-second polling if the stream errors or drops.

function useStaffNotificationSSE(
  token: string,
  onNotification: (n: StaffNotification) => void,
) {
  const cbRef = useRef(onNotification);
  useEffect(() => { cbRef.current = onNotification; }, [onNotification]);

  useEffect(() => {
    if (!token) return;
    const ctrl = new AbortController();
    let alive = true;

    void (async () => {
      try {
        const res = await fetch("/api/admin/notifications/stream", {
          headers: { "X-Staff-Token": token },
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
                  if (payload.notification) cbRef.current(payload.notification as StaffNotification);
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

export function StaffNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);

  const token = getStaffToken() ?? "";

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/notifications", {
        headers: { "X-Staff-Token": token },
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
  const handleSSENotification = useCallback((incoming: StaffNotification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === incoming.id)) return prev;
      return [incoming, ...prev];
    });
  }, []);

  useStaffNotificationSSE(token, handleSSENotification);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-white/70 hover:text-white hover:bg-white/10"
        onClick={() => {
          setOpen(true);
          fetchNotifications();
        }}
        aria-label={`Staff notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <StaffNotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
        token={token}
        onUpdate={setNotifications}
      />
    </>
  );
}
