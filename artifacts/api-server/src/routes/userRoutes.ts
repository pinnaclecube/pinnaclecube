import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";

const router: IRouter = Router();

// Define the zod schema for user registration
const RegisterUserBody = z.object({
  email: z.string().email(),
  name: z.string(), // Assuming name is required, modify as needed
});

router.post(
  "/api/users",
  async (req: Request, res: Response): Promise<void> => {
    // Parse and validate the request body
    const parsed = RegisterUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request data" });
      return;
    }

    const { email, name } = parsed.data;
    
    // Check for email uniqueness respecting case sensitivity
    const existingUser = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.email, email));
    
    if (existingUser.length > 0) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    // Proceed to create the user
    await db.insert(profilesTable).values({ email, name });
    res.status(201).json({ message: "User created successfully" });
  }
);

export { router as userRouter };