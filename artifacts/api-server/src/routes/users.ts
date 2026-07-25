// === artifacts/api-server/src/routes/users.ts ===
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { hash } from "bcryptjs";

const router = Router();

// POST /api/users — create a new user
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName } = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };

  // Validate required fields
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["email", "password", "firstName", "lastName"],
    });
    return;
  }

  // Validate email format
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        error: "Email already exists",
        message: "A user with this email address is already registered.",
      });
      return;
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      user,
    });
  } catch (err: any) {
    console.error("[POST /users] Error creating user:", err);
    res.status(500).json({
      error: "Failed to create user",
      detail: err?.message ?? "Unknown error",
    });
  }
});

export default router;