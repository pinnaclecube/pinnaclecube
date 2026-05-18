/**
 * staffNotificationService.ts — Pinnacle³
 *
 * Shared helper for inserting real-time staff notifications.
 * Fire-and-forget — never throws; errors are logged only.
 * Emits an SSE event to all connected staff clients after each insert.
 */

import { count, eq, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { emitToStaff } from "./sseService";
import { logger } from "../lib/logger";

/**
 * Inserts a staff notification row, then broadcasts it via SSE to all
 * connected staff clients.
 *
 * @param title       Short headline (e.g. "Task Completed ✓")
 * @param message     Full notification body
 * @param link        Optional deep-link for the staff portal
 * @param caseSetupId Optional case ID for cross-referencing
 */
export async function insertStaffNotification(
  title: string,
  message: string,
  link?: string | null,
  caseSetupId?: number | null,
): Promise<void> {
  try {
    const [notification] = await db.insert(notificationsTable).values({
      profileId: null,
      userType: "staff",
      staffId: null,
      caseSetupId: caseSetupId ?? null,
      notificationType: "staff_alert",
      title,
      message,
      link: link ?? null,
      status: "unread",
      priority: "medium",
    }).returning();

    if (!notification) return;

    const [row] = await db
      .select({ unreadCount: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userType, "staff"),
          eq(notificationsTable.status, "unread"),
        ),
      );

    emitToStaff("notification", {
      unreadCount: Number(row?.unreadCount ?? 1),
      notification,
    });
  } catch (err) {
    logger.error({ err, title }, "[staffNotification] failed to insert staff notification");
  }
}
