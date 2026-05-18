/**
 * staffNotificationService.ts — Pinnacle³
 *
 * Shared helper for inserting real-time staff notifications.
 * Fire-and-forget — never throws; errors are logged only.
 */

import { db, notificationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Inserts a staff notification row.
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
    await db.insert(notificationsTable).values({
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
    });
  } catch (err) {
    logger.error({ err, title }, "[staffNotification] failed to insert staff notification");
  }
}
