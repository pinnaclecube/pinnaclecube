/**
 * adminBoothEvents.ts — Pinnacle³
 *
 * Staff-only booth event management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, boothEventsTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { z } from "zod/v4";

const router: IRouter = Router();

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── List events ───────────────────────────────────────────────────────────────

router.get(
  "/admin/booth-events",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const events = await db
      .select()
      .from(boothEventsTable)
      .orderBy(desc(boothEventsTable.createdAt));
    res.json({ events });
  },
);

// ─── Create event ──────────────────────────────────────────────────────────────

const CreateBody = z.object({
  name: z.string().min(1).max(120),
});

router.post(
  "/admin/booth-events",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      return;
    }

    const base = toSlug(parsed.data.name);
    // Ensure slug uniqueness by appending a short timestamp suffix if needed
    let slug = base;
    const existing = await db
      .select({ slug: boothEventsTable.slug })
      .from(boothEventsTable)
      .where(eq(boothEventsTable.slug, base));
    if (existing.length > 0) {
      slug = `${base}-${Date.now().toString(36)}`;
    }

    const [event] = await db
      .insert(boothEventsTable)
      .values({ name: parsed.data.name, slug })
      .returning();

    res.json({ event });
  },
);

// ─── Toggle active / deactivate ────────────────────────────────────────────────

router.patch(
  "/admin/booth-events/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

    const PatchBody = z.object({ active: z.boolean() });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

    const [event] = await db
      .update(boothEventsTable)
      .set({ active: parsed.data.active })
      .where(eq(boothEventsTable.id, id))
      .returning();

    res.json({ event });
  },
);

// ─── Delete event ──────────────────────────────────────────────────────────────

router.delete(
  "/admin/booth-events/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(boothEventsTable).where(eq(boothEventsTable.id, id));
    res.json({ success: true });
  },
);

export default router;
