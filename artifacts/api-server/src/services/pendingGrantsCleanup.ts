import { db, pendingAccessGrantsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // run every 6 hours

async function purgeExpiredPendingGrants(): Promise<void> {
  const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);
  try {
    const deleted = await db
      .delete(pendingAccessGrantsTable)
      .where(lt(pendingAccessGrantsTable.createdAt, cutoff))
      .returning({ id: pendingAccessGrantsTable.id });
    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, "Purged expired pending access grants");
    }
  } catch (err) {
    logger.error({ err }, "Failed to purge expired pending access grants");
  }
}

export function startPendingGrantsCleanup(): void {
  purgeExpiredPendingGrants();
  setInterval(purgeExpiredPendingGrants, CLEANUP_INTERVAL_MS);
}
