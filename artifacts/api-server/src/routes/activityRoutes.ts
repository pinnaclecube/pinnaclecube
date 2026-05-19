/**
 * activityRoutes.ts — Pinnacle³
 *
 * Client-facing page-visit tracking endpoints.
 *
 * POST /activity/page-visit  — fired on page mount
 * POST /activity/page-exit   — fired on unmount (via navigator.sendBeacon or fetch keepalive)
 */

import { Router, type Request, type Response } from "express";
import { requireClientAuth } from "../middlewares/clientAuth";
import { logActivity } from "../services/activityLogger";
import { z } from "zod";

const router = Router();

const PageVisitBody = z.object({
  pageName: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

const PageExitBody = z.object({
  pageName: z.string().min(1).max(100),
  durationSeconds: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  "/activity/page-visit",
  requireClientAuth,
  (req: Request, res: Response): void => {
    const profileId = (req as any).clientUser?.id as number;
    const parsed = PageVisitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    logActivity({
      profileId,
      eventType: "page_visited",
      description: `Visited ${parsed.data.pageName}`,
      actor: "client",
      category: "navigation",
      metadata: { pageName: parsed.data.pageName, ...parsed.data.metadata },
    });
    res.status(204).end();
  },
);

router.post(
  "/activity/page-exit",
  requireClientAuth,
  (req: Request, res: Response): void => {
    const profileId = (req as any).clientUser?.id as number;
    const parsed = PageExitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    logActivity({
      profileId,
      eventType: "page_exited",
      description: `Left ${parsed.data.pageName}${parsed.data.durationSeconds != null ? ` after ${parsed.data.durationSeconds}s` : ""}`,
      actor: "client",
      category: "navigation",
      metadata: {
        pageName: parsed.data.pageName,
        durationSeconds: parsed.data.durationSeconds ?? null,
        ...parsed.data.metadata,
      },
    });
    res.status(204).end();
  },
);

export default router;
