import { useEffect } from "react";

export function usePageTracking(
  pageName: string,
  metadata?: Record<string, unknown>,
): void {
  useEffect(() => {
    const startTime = Date.now();
    const token = localStorage.getItem("pinnacle_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/activity/page-visit", {
      method: "POST",
      headers,
      body: JSON.stringify({ pageName, metadata }),
    }).catch(() => {});

    return () => {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      const payload = JSON.stringify({ pageName, durationSeconds, metadata });
      const blob = new Blob([payload], { type: "application/json" });
      if (!navigator.sendBeacon("/api/activity/page-exit", blob)) {
        fetch("/api/activity/page-exit", {
          method: "POST",
          headers,
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageName]);
}
