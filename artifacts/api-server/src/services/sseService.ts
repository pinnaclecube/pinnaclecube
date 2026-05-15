/**
 * sseService.ts — Pinnacle³
 *
 * In-process Server-Sent Events (SSE) connection registry.
 * Tracks open SSE response streams keyed by caseId and broadcasts
 * events to all connected clients for a given case.
 */

import type { Response } from "express";
import { logger } from "../lib/logger";

// Map<caseId → Set of open SSE Response objects>
const connections = new Map<number, Set<Response>>();

export function addSseClient(caseId: number, res: Response): void {
  if (!connections.has(caseId)) connections.set(caseId, new Set());
  connections.get(caseId)!.add(res);
  logger.info({ caseId, total: connections.get(caseId)!.size }, "[sse] client connected");
}

export function removeSseClient(caseId: number, res: Response): void {
  const set = connections.get(caseId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(caseId);
  logger.info({ caseId }, "[sse] client disconnected");
}

/**
 * Broadcasts an SSE event to every client subscribed to `caseId`.
 * Dead connections are silently pruned.
 */
export function emitToCase(
  caseId: number,
  event: string,
  data: unknown,
): void {
  const set = connections.get(caseId);
  if (!set || set.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

export function getConnectionCount(caseId: number): number {
  return connections.get(caseId)?.size ?? 0;
}
