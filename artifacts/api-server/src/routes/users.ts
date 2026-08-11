import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  res.status(201).json({ success: true });
});

export default router;