import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcrypt";

const router = Router();

// POST /api/users  — create a new user
router.post(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, firstName, lastName } = req.body as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    try {
      // Query for existing user with same email
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }

      const hashedPassword = await hash(password, 10);

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          firstName,
          lastName,
        })
        .returning();

      res.status(201).json({ user: newUser });
    } catch (err: any) {
      // Catch database unique constraint violations
      if (err.code === "23505" || err.constraint?.includes("email")) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }

      req.log.error({ err }, "Failed to create user");
      res.status(500).json({ error: "Failed to create user" });
    }
  },
);

export default router;