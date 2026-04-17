import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { verifyToken } from "../services/auth";

const CURRENT_DISCLAIMER_VERSION =
  process.env.CURRENT_DISCLAIMER_VERSION ?? "1.0";

export async function requireClientAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  let payload: { sub: number; email: string };
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, payload.sub))
    .limit(1);

  if (!profile) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // Disclaimer version check
  if (
    !profile.disclaimerAccepted ||
    profile.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION
  ) {
    res.status(403).json({
      error: "Disclaimer update required",
      requiresReconsent: true,
      currentVersion: CURRENT_DISCLAIMER_VERSION,
    });
    return;
  }

  // Attach to request
  (req as Request & { clientUser: typeof profile }).clientUser = profile;
  next();
}
