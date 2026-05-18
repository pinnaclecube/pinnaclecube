/**
 * sseService.ts — Pinnacle³
 *
 * In-process Server-Sent Events (SSE) connection registry.
 * Three registries:
 *  - connections:        Map<caseId → Set<Response>>    Drive sync events
 *  - profileConnections: Map<profileId → Set<Response>> Client notification bells
 *  - staffConnections:   Set<Response>                  Staff notification bell (broadcast)
 */

import type { Response } from "express";
import { logger } from "../lib/logger";

// ─── Case connections ─────────────────────────────────────────────────────────

const connections = new Map<number, Set<Response>>();

export function addSseClient(caseId: number, res: Response): void {
  if (!connections.has(caseId)) connections.set(caseId, new Set());
  connections.get(caseId)!.add(res);
  logger.info({ caseId, total: connections.get(caseId)!.size }, "[sse] case client connected");
}

export function removeSseClient(caseId: number, res: Response): void {
  const set = connections.get(caseId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(caseId);
  logger.info({ caseId }, "[sse] case client disconnected");
}

export function emitToCase(caseId: number, event: string, data: unknown): void {
  const set = connections.get(caseId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { set.delete(res); }
  }
}

export function getConnectionCount(caseId: number): number {
  return connections.get(caseId)?.size ?? 0;
}

// ─── Profile connections (client notification bell) ───────────────────────────

const profileConnections = new Map<number, Set<Response>>();

export function addProfileSseClient(profileId: number, res: Response): void {
  if (!profileConnections.has(profileId)) profileConnections.set(profileId, new Set());
  profileConnections.get(profileId)!.add(res);
  logger.info({ profileId, total: profileConnections.get(profileId)!.size }, "[sse] profile client connected");
}

export function removeProfileSseClient(profileId: number, res: Response): void {
  const set = profileConnections.get(profileId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) profileConnections.delete(profileId);
  logger.info({ profileId }, "[sse] profile client disconnected");
}

export function emitToProfile(profileId: number, event: string, data: unknown): void {
  const set = profileConnections.get(profileId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { set.delete(res); }
  }
}

// ─── Staff connections (staff notification bell — broadcast to all staff) ──────

const staffConnections = new Set<Response>();

export function addStaffSseClient(res: Response): void {
  staffConnections.add(res);
  logger.info({ total: staffConnections.size }, "[sse] staff client connected");
}

export function removeStaffSseClient(res: Response): void {
  staffConnections.delete(res);
  logger.info({ total: staffConnections.size }, "[sse] staff client disconnected");
}

export function emitToStaff(event: string, data: unknown): void {
  if (staffConnections.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of staffConnections) {
    try { res.write(payload); } catch { staffConnections.delete(res); }
  }
}
