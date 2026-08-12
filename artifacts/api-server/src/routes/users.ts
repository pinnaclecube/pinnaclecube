/**
 * users.ts — Pinnacle³
 *
 * User creation and management routes.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, profilesTable } from "@workspace/db";
import { z } from "zod/v4";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// ─── Create user ───────────────────────────────────────────────────────────────

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

router.post(
  "/api/users",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { email, password, firstName, lastName } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(profilesTable)
      .values({
        email,
        passwordHash,
        firstName,
        lastName,
      })
      .returning({
        id: profilesTable.id,
        email: profilesTable.email,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
      });

    res.status(201).json({ user });
  },
);

export default router;