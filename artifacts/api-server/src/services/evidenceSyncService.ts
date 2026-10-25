/**
 * evidenceSyncService.ts — Pinnacle³
 *
 * Step 3 — Evidence registry sync. Walks a case's Evidence/ subtree and reconciles
 * it into the existing Drive mirror (case_folder_items), on top of the generic
 * syncFolderContents (which upserts files + soft-deletes missing ones). This layer
 * adds the evidence-specific classification: it stamps each item's criterion_folder
 * from its parent subfolder name, and throttles via drive_sync_state.
 *
 * Reuses syncFolderContents (webhook/Drive-Folders sync) — does not duplicate it.
 * Never throws: logs partial errors and continues.
 */

import { eq } from "drizzle-orm";
import {
  db,
  caseFoldersTable,
  caseFolderItemsTable,
  casePetitionSetupTable,
  driveSyncStateTable,
} from "@workspace/db";
import { VISA_FOLDER_STRUCTURE } from "../config/driveFolderConfig";
import { syncFolderContents } from "./driveWatchService";
import { logger } from "../lib/logger";

const THROTTLE_MS = 2 * 60 * 1000; // skip if synced within the last 2 minutes

// ─── Criterion classification ────────────────────────────────────────────────────

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// All known criterion folder names across visa categories → normalized key.
const KNOWN_CRITERION_KEYS: Set<string> = new Set(
  Object.values(VISA_FOLDER_STRUCTURE).flatMap((v) => v.criteria.map((c) => normalizeKey(c.name))),
);

/** Normalized criterion key for a folder name, or 'unclassified' if unrecognized. */
export function criterionKeyForFolderName(name: string): string {
  const key = normalizeKey(name);
  return KNOWN_CRITERION_KEYS.has(key) ? key : "unclassified";
}

// Normalized key → canonical display name (first match across visa categories).
const KEY_TO_DISPLAY: Record<string, string> = {};
for (const v of Object.values(VISA_FOLDER_STRUCTURE)) {
  for (const c of v.criteria) {
    const k = normalizeKey(c.name);
    if (!(k in KEY_TO_DISPLAY)) KEY_TO_DISPLAY[k] = c.name;
  }
}

/** Human-readable label for a criterion key. */
export function criterionDisplayName(key: string): string {
  if (key === "unclassified") return "Unclassified";
  return KEY_TO_DISPLAY[key] ?? "Unclassified";
}

// ─── Evidence subtree resolution ─────────────────────────────────────────────────

export type EvidenceFolder = typeof caseFoldersTable.$inferSelect;

/** The Evidence root folder + all its descendants (criteria + any custom subfolders). */
export async function getEvidenceSubtreeFolders(caseId: number): Promise<EvidenceFolder[]> {
  const folders = await db
    .select()
    .from(caseFoldersTable)
    .where(eq(caseFoldersTable.caseId, caseId));

  const root = folders.find((f) => f.folderType === "evidence");
  if (!root) return [];

  const subtree: EvidenceFolder[] = [root];
  const queue = [root.id];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const f of folders) {
      if (f.parentFolderId === parentId && !subtree.some((s) => s.id === f.id)) {
        subtree.push(f);
        queue.push(f.id);
      }
    }
  }
  return subtree;
}

// ─── Case-level evidence sync (throttled, idempotent, never throws) ──────────────

export async function syncCaseEvidence(
  caseId: number,
  opts?: { force?: boolean },
): Promise<{ synced: boolean; syncedAt: Date | null }> {
  try {
    const [state] = await db
      .select()
      .from(driveSyncStateTable)
      .where(eq(driveSyncStateTable.caseId, caseId))
      .limit(1);

    const now = new Date();
    if (
      !opts?.force &&
      state?.lastSyncedAt &&
      now.getTime() - state.lastSyncedAt.getTime() < THROTTLE_MS
    ) {
      return { synced: false, syncedAt: state.lastSyncedAt };
    }

    const subtree = await getEvidenceSubtreeFolders(caseId);
    for (const folder of subtree) {
      try {
        await syncFolderContents(folder.driveId); // upsert files + soft-delete missing
      } catch (err) {
        logger.error({ err, caseId, folderId: folder.id }, "[evidenceSync] folder sync failed — continuing");
      }
      // Stamp the criterion on every item in this folder (any source).
      try {
        await db
          .update(caseFolderItemsTable)
          .set({ criterionFolder: criterionKeyForFolderName(folder.name) })
          .where(eq(caseFolderItemsTable.caseFolderId, folder.id));
      } catch (err) {
        logger.error({ err, caseId, folderId: folder.id }, "[evidenceSync] criterion stamp failed — continuing");
      }
    }

    await db
      .insert(driveSyncStateTable)
      .values({ caseId, lastSyncedAt: now })
      .onConflictDoUpdate({
        target: driveSyncStateTable.caseId,
        set: { lastSyncedAt: now, updatedAt: now },
      });

    logger.info({ caseId, folders: subtree.length }, "[evidenceSync] case evidence synced");

    // Auto-propose groups when enough ungrouped files have accumulated. Dynamic
    // import avoids a static cycle (grouping service imports this module). Never throws.
    try {
      const { maybeAutoEnqueueGrouping } = await import("./evidenceGroupingWorker");
      await maybeAutoEnqueueGrouping(caseId);
    } catch (err) {
      logger.error({ err, caseId }, "[evidenceSync] auto-enqueue grouping failed");
    }

    return { synced: true, syncedAt: now };
  } catch (err) {
    logger.error({ err, caseId }, "[evidenceSync] syncCaseEvidence failed");
    return { synced: false, syncedAt: null };
  }
}

// ─── Periodic batch (Vercel cron safety-net; webhooks are the primary trigger) ───

export async function syncActiveCasesEvidence(): Promise<void> {
  const cases = await db.select({ id: casePetitionSetupTable.id }).from(casePetitionSetupTable);
  for (const c of cases) {
    // Respects the per-case throttle; never throws (syncCaseEvidence swallows errors).
    await syncCaseEvidence(c.id);
  }
  logger.info({ count: cases.length }, "[evidenceSync] periodic batch complete");
}
