import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
