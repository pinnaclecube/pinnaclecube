/**
 * activityLogger.ts — Pinnacle³
 *
 * Single shared helper for writing to the client_activity_log table.
 * Always fire-and-forget — never throws, never blocks the caller.
 */

import { db, clientActivityLogTable } from "@workspace/db";
import { logger } from "../lib/logger";

export type ActivityActor = "client" | "staff" | "system";
export type ActivityCategory =
  | "auth"
  | "files"
  | "tasks"
  | "exhibits"
  | "assessment"
  | "navigation"
  | "system";

export interface ActivityLogParams {
  profileId: number;
  eventType: string;
  description?: string;
  actor?: ActivityActor;
  actorName?: string | null;
  category?: ActivityCategory;
  caseSetupId?: number | null;
  metadata?: Record<string, unknown>;
}

export function logActivity(params: ActivityLogParams): void {
  const eventData: Record<string, unknown> = {};
  if (params.description) eventData.message = params.description;
  if (params.metadata) Object.assign(eventData, params.metadata);

  void db
    .insert(clientActivityLogTable)
    .values({
      profileId: params.profileId,
      eventType: params.eventType,
      eventData,
      actor: params.actor ?? null,
      actorName: params.actorName ?? null,
      category: params.category ?? null,
      caseSetupId: params.caseSetupId ?? null,
    })
    .catch((err: unknown) => {
      logger.error(
        { err, eventType: params.eventType, profileId: params.profileId },
        "[activityLogger] failed to log activity",
      );
    });
}
